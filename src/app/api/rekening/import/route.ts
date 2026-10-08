import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit } from "@/generated/prisma/enums";
import { bolehBrand } from "@/lib/akses";
import { hitungUlangSaldo } from "@/lib/rekap";
import { analisaRekening, MAKS_UKURAN_EXCEL_REKENING } from "@/lib/rekening-impor";

/**
 * Import massal rekening dari Excel.
 *   mode=cek      → hanya menganalisis (untuk pop-up pratinjau), tidak menyimpan
 *   mode=terapkan → menyimpan baris baru + menerapkan perubahan
 *
 * Perubahan saldo awal / bank pada rekening yang sudah punya transaksi akan
 * menghitung ulang saldo berjalan rekening itu.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "cek");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Pilih file Excel (.xlsx) dulu" }, { status: 400 });
    }
    if (file.size > MAKS_UKURAN_EXCEL_REKENING) {
      return NextResponse.json({ error: "File lebih dari 5MB" }, { status: 413 });
    }

    const analisa = await analisaRekening(await file.arrayBuffer());
    if (!analisa.ok) return NextResponse.json({ error: analisa.pesan }, { status: 400 });
    const h = analisa.hasil;

    const ringkas = {
      namaSheet: h.namaSheet,
      jumlahBaris: h.jumlahBaris,
      baru: h.baru.length,
      ubah: h.ubah.length,
      sama: h.jumlahSama,
      gagal: h.gagal,
      contohBaru: h.baru.slice(0, 40),
      contohUbah: h.ubah.slice(0, 40),
    };
    if (mode !== "terapkan") return NextResponse.json({ ...ringkas, diterapkan: false });

    if (h.baru.length === 0 && h.ubah.length === 0) {
      return NextResponse.json({ ...ringkas, diterapkan: false, pesan: "Tidak ada perubahan untuk disimpan" });
    }

    const hasil = await prisma.$transaction(
      async (tx) => {
        const brands = await tx.brand.findMany({ select: { id: true, kunci: true } });
        const idBrand = new Map(brands.map((b) => [b.kunci, b.id]));
        const rekeningLama = await tx.rekening.findMany({ select: { id: true, nama: true } });
        const idRek = new Map(rekeningLama.map((r) => [r.nama.toLowerCase(), r.id]));

        // Batasi: brand yang bukan milik pengguna ditolak (bukan di-skip diam-diam).
        for (const r of [...h.baru, ...h.ubah]) {
          if (r.brandKunci && !bolehBrand(auth.user, idBrand.get(r.brandKunci) ?? null)) {
            throw new Error(`Brand "${r.brand}" di luar yang ditugaskan ke kamu (baris ${r.baris})`);
          }
        }

        if (h.baru.length > 0) {
          await tx.rekening.createMany({
            data: h.baru.map((r) => ({
              nama: r.nama,
              bank: r.bank,
              nomorRekening: r.nomorRekening,
              saldoAwal: new Prisma.Decimal(r.saldoAwal),
              tanggalSaldoAwal: new Date(`${r.tanggalSaldoAwal}T00:00:00.000Z`),
              urutan: r.urutan,
              brandId: r.brandKunci ? idBrand.get(r.brandKunci) ?? null : null,
            })),
          });
        }

        let dihitungUlang = 0;
        for (const r of h.ubah) {
          const id = idRek.get(r.nama.toLowerCase());
          if (!id) continue;
          await tx.rekening.update({
            where: { id },
            data: {
              bank: r.bank,
              nomorRekening: r.nomorRekening,
              saldoAwal: new Prisma.Decimal(r.saldoAwal),
              tanggalSaldoAwal: new Date(`${r.tanggalSaldoAwal}T00:00:00.000Z`),
              urutan: r.urutan,
              brandId: r.brandKunci ? idBrand.get(r.brandKunci) ?? null : null,
            },
          });
          if (r.diubah.includes("saldoAwal") || r.diubah.includes("tanggalSaldoAwal")) {
            await hitungUlangSaldo(tx, id);
            dihitungUlang++;
          }
        }

        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            entitas: "Rekening",
            entitasId: `import-${Date.now()}`,
            aksi: AksiAudit.BUAT,
            dataBaru: {
              file: file.name.slice(0, 120),
              rekeningBaru: h.baru.map((r) => r.nama).slice(0, 200),
              diubah: h.ubah.map((r) => ({ nama: r.nama, field: r.diubah })).slice(0, 200),
              dihitungUlang,
            },
          },
        });
        return { dihitungUlang };
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return NextResponse.json({ ...ringkas, ...hasil, diterapkan: true });
  } catch (err) {
    return apiError(err);
  }
}
