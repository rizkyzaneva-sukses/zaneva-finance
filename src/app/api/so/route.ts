import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan, statusAccUntuk } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, JenisSo } from "@/generated/prisma/enums";
import { MAKS_UKURAN_EXCEL } from "@/lib/produk";
import { analisaSo } from "@/lib/stok-impor";
import { hariIniWib } from "@/lib/alokasi";

const FORMAT_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Riwayat stok opname. Nilai rupiah hanya untuk role yang boleh melihat laporan. */
export async function GET() {
  const auth = await wajibLogin(undefined, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const lihatNilai = bolehLihatLaporan(auth.user.role);
    const [daftar, perBrand] = await Promise.all([
      prisma.stokOpname.findMany({
        orderBy: [{ posisiPada: "desc" }, { createdAt: "desc" }],
        include: {
          diunggahOleh: { select: { nama: true } },
          accOleh: { select: { nama: true } },
        },
      }),
      prisma.stokOpnameItem.groupBy({
        by: ["stokOpnameId", "brandId"],
        _sum: { stok: true, nilai: true },
      }),
    ]);
    const brand = await prisma.brand.findMany({ select: { id: true, nama: true } });
    const namaBrand = new Map(brand.map((b) => [b.id, b.nama]));

    const so = daftar.map((s) => ({
      id: s.id,
      jenis: s.jenis,
      tanggalInput: iso(s.tanggalInput),
      posisiPada: iso(s.posisiPada),
      catatan: s.catatan,
      jumlahSku: s.jumlahSku,
      totalStok: s.totalStok,
      totalNilai: lihatNilai ? s.totalNilai.toNumber() : null,
      statusAcc: s.statusAcc,
      accOleh: s.accOleh?.nama ?? null,
      diunggahOleh: s.diunggahOleh?.nama ?? null,
      createdAt: s.createdAt,
      perBrand: perBrand
        .filter((p) => p.stokOpnameId === s.id)
        .map((p) => ({
          brand: namaBrand.get(p.brandId) ?? "?",
          stok: p._sum.stok ?? 0,
          nilai: lihatNilai ? (p._sum.nilai?.toNumber() ?? 0) : null,
        }))
        .sort((a, b) => a.brand.localeCompare(b.brand)),
    }));
    return NextResponse.json({ so, lihatNilai });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * Unggah stok opname (semua produk, semua brand sekaligus).
 *   mode=cek    → analisis saja, balas pratinjau + error per baris
 *   mode=simpan → simpan. Kalau ada baris gagal, wajib simpanValidSaja=true (keputusan sadar pengguna).
 * HPP tiap SKU di-snapshot dari master saat disimpan.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(undefined, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "cek");
    const jenis = String(form.get("jenis") ?? "") as JenisSo;
    const tanggalInput = String(form.get("tanggalInput") ?? "");
    const posisiPada = String(form.get("posisiPada") ?? "");
    const catatan = String(form.get("catatan") ?? "").trim().slice(0, 300) || null;
    const simpanValidSaja = form.get("simpanValidSaja") === "true";
    const timpa = form.get("timpa") === "true";

    if (!Object.values(JenisSo).includes(jenis)) {
      return NextResponse.json({ error: "Pilih jenis: Persediaan Awal atau SO Bulanan" }, { status: 400 });
    }
    if (!FORMAT_TANGGAL.test(tanggalInput) || !FORMAT_TANGGAL.test(posisiPada)) {
      return NextResponse.json({ error: "Tanggal SO wajib diisi" }, { status: 400 });
    }
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Pilih file Excel (.xlsx) dulu" }, { status: 400 });
    }
    if (file.size > MAKS_UKURAN_EXCEL) {
      return NextResponse.json({ error: "File lebih dari 5MB" }, { status: 413 });
    }

    // ── Aturan tanggal & urutan ──
    const hariIni = hariIniWib();
    let blokir: string | null = null;
    if (tanggalInput > hariIni) blokir = "Tanggal input tidak boleh di masa depan.";
    else if (posisiPada > tanggalInput) blokir = "Tanggal stok tidak boleh setelah tanggal input.";

    const [awal, sama] = await Promise.all([
      prisma.stokOpname.findFirst({ where: { jenis: JenisSo.AWAL } }),
      prisma.stokOpname.findFirst({
        where: jenis === JenisSo.AWAL ? { jenis: JenisSo.AWAL } : { jenis: JenisSo.BULANAN, posisiPada: new Date(`${posisiPada}T00:00:00.000Z`) },
      }),
    ]);

    if (!blokir) {
      if (jenis === JenisSo.BULANAN) {
        if (!awal) blokir = "Belum ada Persediaan Awal. Unggah Persediaan Awal dulu sebelum SO Bulanan.";
        else if (posisiPada <= iso(awal.posisiPada)) {
          blokir = `SO Bulanan harus setelah Persediaan Awal (${iso(awal.posisiPada)}).`;
        }
      } else {
        const bulananPertama = await prisma.stokOpname.findFirst({
          where: { jenis: JenisSo.BULANAN },
          orderBy: { posisiPada: "asc" },
        });
        if (bulananPertama && posisiPada >= iso(bulananPertama.posisiPada)) {
          blokir = `Tanggal Persediaan Awal harus sebelum SO Bulanan pertama (${iso(bulananPertama.posisiPada)}).`;
        }
      }
    }
    const konflik = sama
      ? {
          id: sama.id,
          jenis: sama.jenis,
          posisiPada: iso(sama.posisiPada),
          pesan:
            jenis === JenisSo.AWAL
              ? "Persediaan Awal sudah pernah diunggah."
              : `SO untuk stok per ${posisiPada} sudah ada.`,
        }
      : null;

    const analisa = await analisaSo(await file.arrayBuffer());
    if (!analisa.ok) return NextResponse.json({ error: analisa.pesan }, { status: 400 });
    const h = analisa.hasil;

    const ringkas = {
      namaSheet: h.namaSheet,
      jumlahBaris: h.jumlahBaris,
      jumlahValid: h.valid.length,
      gagal: h.gagal,
      tidakAdaDiFile: h.tidakAdaDiFile.slice(0, 200),
      tidakAdaTotal: h.tidakAdaDiFile.length,
      hppNol: h.hppNol.slice(0, 20),
      hppNolTotal: h.hppNol.length,
      perBrand: h.perBrand.map((p) => ({
        brand: p.brand,
        jumlahSku: p.jumlahSku,
        stok: p.stok,
        nilai: bolehLihatLaporan(auth.user.role) ? p.nilaiSen / 100 : null,
      })),
      totalStok: h.totalStok,
      totalNilai: bolehLihatLaporan(auth.user.role) ? h.totalNilaiSen / 100 : null,
      blokir,
      konflik,
    };
    if (mode !== "simpan") return NextResponse.json({ ...ringkas, disimpan: false });

    // ── Simpan ──
    if (blokir) return NextResponse.json({ error: blokir, ...ringkas, disimpan: false }, { status: 400 });
    if (h.valid.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris valid untuk disimpan", ...ringkas, disimpan: false }, { status: 400 });
    }
    if (h.gagal.length > 0 && !simpanValidSaja) {
      return NextResponse.json(
        { error: "Ada baris yang gagal. Perbaiki file, atau pilih simpan baris yang valid saja.", ...ringkas, disimpan: false },
        { status: 400 }
      );
    }
    if (konflik && !timpa) {
      return NextResponse.json({ error: konflik.pesan, ...ringkas, disimpan: false }, { status: 409 });
    }

    const hasil = await prisma.$transaction(
      async (tx) => {
        if (konflik) {
          const lama = await tx.stokOpname.findUnique({ where: { id: konflik.id } });
          await tx.stokOpname.delete({ where: { id: konflik.id } });
          await tx.auditLog.create({
            data: {
              userId: auth.user.id,
              entitas: "StokOpname",
              entitasId: konflik.id,
              aksi: AksiAudit.HAPUS,
              dataLama: lama
                ? {
                    jenis: lama.jenis,
                    posisiPada: iso(lama.posisiPada),
                    jumlahSku: lama.jumlahSku,
                    totalNilai: lama.totalNilai.toFixed(2),
                    alasan: "Ditimpa SO baru",
                  }
                : Prisma.JsonNull,
            },
          });
        }
        const status = statusAccUntuk(auth.user.role);
        const so = await tx.stokOpname.create({
          data: {
            jenis,
            tanggalInput: new Date(`${tanggalInput}T00:00:00.000Z`),
            posisiPada: new Date(`${posisiPada}T00:00:00.000Z`),
            catatan,
            jumlahSku: h.valid.length,
            totalStok: h.totalStok,
            totalNilai: new Prisma.Decimal(h.totalNilaiSen).div(100),
            statusAcc: status,
            ...(status === "DISETUJUI" ? { accOlehId: auth.user.id, accPada: new Date() } : {}),
            diunggahOlehId: auth.user.id,
          },
        });
        await tx.stokOpnameItem.createMany({
          data: h.valid.map((v) => ({
            stokOpnameId: so.id,
            produkId: v.produkId,
            sku: v.sku,
            brandId: v.brandId,
            stok: v.stok,
            hpp: new Prisma.Decimal(v.hpp),
            nilai: new Prisma.Decimal(v.nilaiSen).div(100),
          })),
        });
        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            entitas: "StokOpname",
            entitasId: so.id,
            aksi: AksiAudit.BUAT,
            dataBaru: {
              jenis,
              tanggalInput,
              posisiPada,
              jumlahSku: h.valid.length,
              totalStok: h.totalStok,
              totalNilai: (h.totalNilaiSen / 100).toFixed(2),
              barisGagalDilewati: h.gagal.length,
              menimpa: Boolean(konflik),
            },
          },
        });
        return so;
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return NextResponse.json({ ...ringkas, disimpan: true, id: hasil.id, statusAcc: hasil.statusAcc });
  } catch (err) {
    return apiError(err);
  }
}
