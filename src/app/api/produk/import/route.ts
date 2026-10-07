import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit } from "@/generated/prisma/enums";
import { MAKS_UKURAN_EXCEL } from "@/lib/produk";
import { analisaMaster } from "@/lib/stok-impor";

/**
 * Unggah master produk / mass edit HPP.
 *   mode=cek      → hanya menganalisis, tidak menyimpan apa pun (untuk pop up pratinjau)
 *   mode=terapkan → menyimpan baris yang valid. Brand baru hanya dibuat kalau setujuBrandBaru=true.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") ?? "cek");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Pilih file Excel (.xlsx) dulu" }, { status: 400 });
    }
    if (file.size > MAKS_UKURAN_EXCEL) {
      return NextResponse.json({ error: "File lebih dari 5MB" }, { status: 413 });
    }

    const analisa = await analisaMaster(await file.arrayBuffer());
    if (!analisa.ok) return NextResponse.json({ error: analisa.pesan }, { status: 400 });
    const h = analisa.hasil;

    const ringkas = {
      namaSheet: h.namaSheet,
      jumlahBaris: h.jumlahBaris,
      baru: h.perubahan.filter((p) => p.status === "baru").length,
      ubah: h.perubahan.filter((p) => p.status === "ubah").length,
      sama: h.jumlahSama,
      gagal: h.gagal,
      brandBaru: h.brandBaru,
      disamakan: h.disamakan,
      contohUbah: h.perubahan.filter((p) => p.status === "ubah").slice(0, 30),
      contohBaru: h.perubahan.filter((p) => p.status === "baru").slice(0, 10),
    };
    if (mode !== "terapkan") return NextResponse.json({ ...ringkas, diterapkan: false });

    if (h.brandBaru.length > 0 && form.get("setujuBrandBaru") !== "true") {
      return NextResponse.json(
        { error: "Ada brand baru. Setujui pembuatan brand baru dulu.", ...ringkas, diterapkan: false },
        { status: 409 }
      );
    }
    if (h.perubahan.length === 0) {
      return NextResponse.json({ ...ringkas, diterapkan: false, pesan: "Tidak ada perubahan untuk disimpan" });
    }

    await prisma.$transaction(
      async (tx) => {
        for (const b of h.brandBaru) {
          await tx.brand.create({ data: { nama: b.nama, kunci: b.kunci } });
        }
        const brand = await tx.brand.findMany();
        const idBrand = new Map(brand.map((b) => [b.kunci, b.id]));

        const baru = h.perubahan.filter((p) => p.status === "baru");
        if (baru.length > 0) {
          await tx.produk.createMany({
            data: baru.map((p) => ({
              sku: p.sku,
              skuKunci: p.skuKunci,
              brandId: idBrand.get(p.brandKunci)!,
              hpp: new Prisma.Decimal(p.hpp),
            })),
          });
        }
        for (const p of h.perubahan.filter((x) => x.status === "ubah")) {
          await tx.produk.update({
            where: { skuKunci: p.skuKunci },
            data: { hpp: new Prisma.Decimal(p.hpp), brandId: idBrand.get(p.brandKunci)! },
          });
        }
        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            entitas: "Produk",
            entitasId: `import-${Date.now()}`,
            aksi: AksiAudit.UBAH,
            dataBaru: {
              file: file.name.slice(0, 120),
              produkBaru: ringkas.baru,
              diubah: ringkas.ubah,
              brandBaru: h.brandBaru.map((b) => b.nama),
              // Daftar perubahan HPP supaya bisa ditelusuri siapa mengubah apa
              perubahan: h.perubahan.slice(0, 1000).map((p) => ({
                sku: p.sku,
                hpp: p.hpp,
                hppLama: p.hppLama ?? null,
                brandLama: p.brandLama ?? null,
              })),
            },
          },
        });
      },
      { timeout: 120_000, maxWait: 10_000 }
    );

    return NextResponse.json({ ...ringkas, diterapkan: true });
  } catch (err) {
    return apiError(err);
  }
}
