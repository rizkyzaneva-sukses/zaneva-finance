import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehRekap, statusAccUntuk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { StatusKode, Sumber } from "@/generated/prisma/enums";
import { buatDedupeHash, hitungUlangSaldo, urutanInputBerikutnya } from "@/lib/rekap";
import { validasiRincian, type RincianBersih, type RincianMasuk } from "@/lib/split";
import { bolehRekening } from "@/lib/akses";

interface BarisMasuk {
  tanggalIso: string;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  saldoBank: number | null;
  kodeAkunId: string | null;
  statusKode: keyof typeof StatusKode;
  catatan: string;
  yakin: boolean;
  /** true = user sudah lihat peringatan duplikat dan tetap mau memasukkannya */
  paksa?: boolean;
  /** Split: rincian per kode akun. Totalnya harus sama dengan nominal baris ini. */
  rincian?: RincianMasuk[];
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const rekeningId = String(body.rekeningId ?? "");
    const sumber: Sumber = body.sumber === "PDF" ? Sumber.PDF : Sumber.SCREENSHOT;
    const baris: BarisMasuk[] = Array.isArray(body.baris) ? body.baris : [];

    if (!rekeningId) {
      return NextResponse.json({ error: "Rekening wajib dipilih" }, { status: 400 });
    }
    if (baris.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris untuk disimpan" }, { status: 400 });
    }

    const rekening = await prisma.rekening.findUnique({ where: { id: rekeningId } });
    if (!rekening || !rekening.aktif) {
      return NextResponse.json({ error: "Rekening tidak ditemukan atau nonaktif" }, { status: 404 });
    }

    if (!bolehRekening(auth.user, rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }

    const tanpaTanggal = baris.filter((b) => !b.tanggalIso);
    if (tanpaTanggal.length > 0) {
      return NextResponse.json(
        { error: `${tanpaTanggal.length} baris tanggalnya tidak terbaca. Perbaiki dulu sebelum simpan.` },
        { status: 400 }
      );
    }

    // Validasi split di depan, sebelum transaksi DB dibuka: kalau ada satu saja
    // yang totalnya tidak cocok, seluruh batch ditolak dan tidak ada yang tersimpan.
    const rincianPerBaris = new Map<BarisMasuk, RincianBersih[]>();
    for (const [i, b] of baris.entries()) {
      if (!Array.isArray(b.rincian) || b.rincian.length === 0) continue;
      const total = new Prisma.Decimal(b.uangMasuk || b.uangKeluar || 0);
      const cek = await validasiRincian(total, b.rincian);
      if (!cek.ok) {
        return NextResponse.json(
          { error: `Baris ke-${i + 1} (${b.keterangan}): ${cek.error}` },
          { status: 400 }
        );
      }
      rincianPerBaris.set(b, cek.rincian);
    }
    const rincianPerHash = new Map<string, RincianBersih[]>();

    const hasil = await prisma.$transaction(async (tx) => {
      let urutan = await urutanInputBerikutnya(tx, rekeningId);

      const siapSimpan: Prisma.TransaksiCreateManyInput[] = [];
      const dilewati: { tanggalTeks: string; keterangan: string; nominal: number }[] = [];

      // Hash yang sudah ada di DB untuk rekening ini
      const existing = new Set(
        (
          await tx.transaksi.findMany({
            where: { rekeningId },
            select: { dedupeHash: true },
          })
        ).map((t) => t.dedupeHash)
      );

      for (const b of baris) {
        const dedupeHash = buatDedupeHash({
          tanggalIso: b.tanggalIso,
          uangMasuk: b.uangMasuk,
          uangKeluar: b.uangKeluar,
          keterangan: b.keterangan,
        });

        // Duplikat terhadap DB, atau terhadap baris lain di batch yang sama
        const sudahAda = existing.has(dedupeHash);
        if (sudahAda && !b.paksa) {
          dilewati.push({
            tanggalTeks: b.tanggalIso,
            keterangan: b.keterangan,
            nominal: b.uangMasuk || b.uangKeluar,
          });
          continue;
        }
        existing.add(dedupeHash);

        const rincian = rincianPerBaris.get(b);
        const hashFinal = sudahAda ? `${dedupeHash}:dup${urutan}` : dedupeHash;
        if (rincian) rincianPerHash.set(hashFinal, rincian);

        siapSimpan.push({
          rekeningId,
          // Baris yang di-split tidak punya satu kode — kodenya ada di rincian.
          kodeAkunId: rincian ? null : b.kodeAkunId || null,
          tanggal: new Date(`${b.tanggalIso}T00:00:00.000Z`),
          urutanInput: urutan++,
          keterangan: b.keterangan,
          uangMasuk: new Prisma.Decimal(b.uangMasuk || 0),
          uangKeluar: new Prisma.Decimal(b.uangKeluar || 0),
          saldo: new Prisma.Decimal(0), // diisi oleh hitungUlangSaldo
          saldoBank: b.saldoBank == null ? null : new Prisma.Decimal(b.saldoBank),
          catatan: b.catatan?.trim() || null,
          statusKode: rincian
            ? StatusKode.DIKONFIRMASI
            : b.kodeAkunId
              ? StatusKode[b.statusKode] ?? StatusKode.SARAN_AI
              : StatusKode.KOSONG,
          sumber,
          yakin: b.yakin !== false,
          // Duplikat yang sengaja dipaksa masuk butuh hash unik agar lolos constraint
          dedupeHash: hashFinal,
          // STAFF menyimpan rekap → menunggu ACC; ADMIN/OWNER → langsung final.
          statusAcc: statusAccUntuk(auth.user.role),
          createdById: auth.user.id,
        });
      }

      if (siapSimpan.length > 0) {
        await tx.transaksi.createMany({ data: siapSimpan });

        if (rincianPerHash.size > 0) {
          const dibuat = await tx.transaksi.findMany({
            where: { rekeningId, dedupeHash: { in: [...rincianPerHash.keys()] } },
            select: { id: true, dedupeHash: true },
          });
          await tx.transaksiRincian.createMany({
            data: dibuat.flatMap((t) =>
              (rincianPerHash.get(t.dedupeHash) ?? []).map((r) => ({
                transaksiId: t.id,
                kodeAkunId: r.kodeAkunId,
                nominal: r.nominal,
                keterangan: r.keterangan,
                urutan: r.urutan,
              }))
            ),
          });
        }

        await hitungUlangSaldo(tx, rekeningId);
      }

      return { tersimpan: siapSimpan.length, dilewati: dilewati.length, barisDilewati: dilewati };
    });

    return NextResponse.json(hasil);
  } catch (err) {
    return apiError(err);
  }
}
