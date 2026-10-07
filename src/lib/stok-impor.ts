import { prisma } from "@/lib/prisma";
import {
  bacaAngka,
  bacaExcel,
  kunciBrand,
  kunciSku,
  rapikanSku,
  type BarisGagal,
  type BarisExcel,
} from "@/lib/produk";

/**
 * Validasi file Excel master produk (mass edit HPP) dan Stok Opname.
 *
 * Aturan umum: satu baris yang salah tidak menggagalkan baris lain, tapi TIDAK
 * ada baris yang dibuang diam-diam — semuanya masuk daftar `gagal` lengkap dengan
 * nomor baris dan alasannya, yang bisa diunduh sebagai Excel untuk diperbaiki.
 */

const MAKS_HPP = 1_000_000_000; // Rp 1 miliar per unit: di atas ini hampir pasti salah ketik
const MAKS_STOK = 10_000_000;

const rapikanBrand = (b: string) => b.normalize("NFC").trim().replace(/\s+/g, " ");

function hitungKemunculan(baris: BarisExcel[]) {
  const peta = new Map<string, number[]>();
  for (const b of baris) {
    const k = kunciSku(b.sku);
    if (!k) continue;
    peta.set(k, [...(peta.get(k) ?? []), b.nomor]);
  }
  return peta;
}

const teksNilai = (v: BarisExcel["nilai"]): string | number | null =>
  v === null || typeof v === "boolean" ? null : v;

// ─────────────────────────── Master produk ───────────────────────────

export interface PerubahanProduk {
  sku: string;
  skuKunci: string;
  brandKunci: string;
  hpp: number;
  status: "baru" | "ubah";
  hppLama?: number;
  brandLama?: string;
  brandBaru?: string;
}

export interface BrandBaru {
  nama: string;
  kunci: string;
  jumlahSku: number;
}

export interface AnalisisMaster {
  namaSheet: string;
  jumlahBaris: number;
  perubahan: PerubahanProduk[];
  jumlahSama: number;
  gagal: BarisGagal[];
  brandBaru: BrandBaru[];
  /** Penulisan brand berbeda yang disamakan dengan brand yang sudah ada, ditampilkan agar tidak terjadi diam-diam. */
  disamakan: { tertulis: string; jadi: string; jumlah: number }[];
}

export async function analisaMaster(
  buffer: Buffer | ArrayBuffer
): Promise<{ ok: true; hasil: AnalisisMaster } | { ok: false; pesan: string }> {
  const baca = await bacaExcel(buffer, "produk");
  if (!baca.ok) return baca;

  const [produkAda, brandAda] = await Promise.all([
    prisma.produk.findMany({ include: { brand: true } }),
    prisma.brand.findMany(),
  ]);
  const petaProduk = new Map(produkAda.map((p) => [p.skuKunci, p]));
  const petaBrand = new Map(brandAda.map((b) => [b.kunci, b]));
  const kemunculan = hitungKemunculan(baca.baris);

  const gagal: BarisGagal[] = [];
  const perubahan: PerubahanProduk[] = [];
  let jumlahSama = 0;

  // Brand baru: kumpulkan semua penulisannya, nama kanonik = penulisan yang paling sering.
  const kandidatBrandBaru = new Map<string, Map<string, number>>();
  const disamakan = new Map<string, { tertulis: string; jadi: string; jumlah: number }>();
  const tertunda: { baris: BarisExcel; sku: string; hpp: number; brandKunci: string }[] = [];

  for (const b of baca.baris) {
    const sku = rapikanSku(b.sku);
    const brandTulis = rapikanBrand(b.brand);
    const tolak = (alasan: string) =>
      gagal.push({ baris: b.nomor, sku: b.sku, brand: b.brand, nilai: teksNilai(b.nilai), alasan });

    if (!sku) {
      tolak("SKU kosong");
      continue;
    }
    const muncul = kemunculan.get(kunciSku(sku)) ?? [];
    if (muncul.length > 1) {
      tolak(`SKU dobel di file (baris ${muncul.join(", ")}). Sisakan satu baris saja.`);
      continue;
    }
    const hpp = bacaAngka(b.nilai);
    if (!hpp.ok) {
      tolak(`HPP: ${hpp.alasan}`);
      continue;
    }
    if (hpp.n < 0) {
      tolak("HPP tidak boleh negatif");
      continue;
    }
    if (hpp.n > MAKS_HPP) {
      tolak("HPP lebih dari Rp 1 miliar per unit, kemungkinan salah ketik");
      continue;
    }
    const hppBulat = Math.round(hpp.n * 100) / 100;

    const ada = petaProduk.get(kunciSku(sku));
    let brandKunci: string;
    if (!brandTulis) {
      if (!ada) {
        tolak("Brand kosong. SKU baru wajib punya brand.");
        continue;
      }
      brandKunci = ada.brand.kunci;
    } else {
      brandKunci = kunciBrand(brandTulis);
      if (!brandKunci) {
        tolak("Nama brand tidak valid");
        continue;
      }
      const brand = petaBrand.get(brandKunci);
      if (brand) {
        if (brand.nama !== brandTulis) {
          const k = `${brandTulis}→${brand.nama}`;
          const d = disamakan.get(k) ?? { tertulis: brandTulis, jadi: brand.nama, jumlah: 0 };
          d.jumlah += 1;
          disamakan.set(k, d);
        }
      } else {
        const m = kandidatBrandBaru.get(brandKunci) ?? new Map<string, number>();
        m.set(brandTulis, (m.get(brandTulis) ?? 0) + 1);
        kandidatBrandBaru.set(brandKunci, m);
      }
    }
    tertunda.push({ baris: b, sku, hpp: hppBulat, brandKunci });
  }

  // Tetapkan nama kanonik brand baru, lalu klasifikasikan tiap baris.
  const namaBrandBaru = new Map<string, string>();
  const brandBaru: BrandBaru[] = [];
  for (const [kunci, varian] of kandidatBrandBaru) {
    const nama = [...varian.entries()].sort((a, b) => b[1] - a[1])[0][0];
    namaBrandBaru.set(kunci, nama);
    brandBaru.push({ nama, kunci, jumlahSku: [...varian.values()].reduce((s, n) => s + n, 0) });
  }
  for (const [kunci, varian] of kandidatBrandBaru) {
    const nama = namaBrandBaru.get(kunci)!;
    for (const [tulis, n] of varian) {
      if (tulis !== nama) {
        disamakan.set(`${tulis}→${nama}`, { tertulis: tulis, jadi: nama, jumlah: n });
      }
    }
  }

  for (const t of tertunda) {
    const ada = petaProduk.get(kunciSku(t.sku));
    if (!ada) {
      perubahan.push({ sku: t.sku, skuKunci: kunciSku(t.sku), brandKunci: t.brandKunci, hpp: t.hpp, status: "baru" });
      continue;
    }
    const hppBerbeda = !ada.hpp.equals(t.hpp);
    const brandBerbeda = ada.brand.kunci !== t.brandKunci;
    if (!hppBerbeda && !brandBerbeda) {
      jumlahSama++;
      continue;
    }
    perubahan.push({
      sku: ada.sku,
      skuKunci: ada.skuKunci,
      brandKunci: t.brandKunci,
      hpp: t.hpp,
      status: "ubah",
      hppLama: ada.hpp.toNumber(),
      ...(brandBerbeda
        ? {
            brandLama: ada.brand.nama,
            brandBaru: petaBrand.get(t.brandKunci)?.nama ?? namaBrandBaru.get(t.brandKunci) ?? t.brandKunci,
          }
        : {}),
    });
  }

  return {
    ok: true,
    hasil: {
      namaSheet: baca.namaSheet,
      jumlahBaris: baca.baris.length,
      perubahan,
      jumlahSama,
      gagal,
      brandBaru,
      disamakan: [...disamakan.values()],
    },
  };
}

// ─────────────────────────── Stok Opname ───────────────────────────

export interface ItemSo {
  produkId: string;
  sku: string;
  brandId: string;
  stok: number;
  hpp: string; // desimal sebagai teks, supaya tidak lewat float
  nilaiSen: number;
}

export interface AnalisisSo {
  namaSheet: string;
  jumlahBaris: number;
  valid: ItemSo[];
  gagal: BarisGagal[];
  tidakAdaDiFile: { sku: string; brand: string }[];
  hppNol: { sku: string; stok: number }[];
  perBrand: { brandId: string; brand: string; jumlahSku: number; stok: number; nilaiSen: number }[];
  totalStok: number;
  totalNilaiSen: number;
}

export async function analisaSo(
  buffer: Buffer | ArrayBuffer
): Promise<{ ok: true; hasil: AnalisisSo } | { ok: false; pesan: string }> {
  const baca = await bacaExcel(buffer, "so");
  if (!baca.ok) return baca;

  const produkAda = await prisma.produk.findMany({ include: { brand: true } });
  if (produkAda.length === 0) {
    return { ok: false, pesan: "Master produk masih kosong. Unggah master produk dulu di tab Master Produk." };
  }
  const petaProduk = new Map(produkAda.map((p) => [p.skuKunci, p]));
  const kemunculan = hitungKemunculan(baca.baris);

  const gagal: BarisGagal[] = [];
  const valid: ItemSo[] = [];
  const terlihat = new Set<string>();
  const hppNol: { sku: string; stok: number }[] = [];
  const perBrand = new Map<string, { brandId: string; brand: string; jumlahSku: number; stok: number; nilaiSen: number }>();

  for (const b of baca.baris) {
    const tolak = (alasan: string) =>
      gagal.push({ baris: b.nomor, sku: b.sku, nilai: teksNilai(b.nilai), alasan });
    const sku = rapikanSku(b.sku);
    if (!sku) {
      tolak("SKU kosong");
      continue;
    }
    const kunci = kunciSku(sku);
    const produk = petaProduk.get(kunci);
    if (!produk) {
      tolak("SKU tidak ada di master produk. Cek ejaan, atau tambahkan dulu di Master Produk.");
      continue;
    }
    terlihat.add(kunci);
    const muncul = kemunculan.get(kunci) ?? [];
    if (muncul.length > 1) {
      tolak(`SKU dobel di file (baris ${muncul.join(", ")}). Sisakan satu baris saja.`);
      continue;
    }
    const stok = bacaAngka(b.nilai);
    if (!stok.ok) {
      tolak(`STOK SO: ${stok.alasan}`);
      continue;
    }
    if (!Number.isInteger(stok.n)) {
      tolak("STOK SO harus bilangan bulat (tanpa koma)");
      continue;
    }
    if (stok.n < 0) {
      tolak("STOK SO tidak boleh negatif");
      continue;
    }
    if (stok.n > MAKS_STOK) {
      tolak("STOK SO lebih dari 10 juta, kemungkinan salah ketik");
      continue;
    }

    const nilaiSen = Math.round(produk.hpp.mul(100).toNumber()) * stok.n;
    valid.push({
      produkId: produk.id,
      sku: produk.sku,
      brandId: produk.brandId,
      stok: stok.n,
      hpp: produk.hpp.toFixed(2),
      nilaiSen,
    });
    if (stok.n > 0 && produk.hpp.equals(0)) hppNol.push({ sku: produk.sku, stok: stok.n });
    const pb = perBrand.get(produk.brandId) ?? {
      brandId: produk.brandId,
      brand: produk.brand.nama,
      jumlahSku: 0,
      stok: 0,
      nilaiSen: 0,
    };
    if (stok.n > 0) pb.jumlahSku += 1;
    pb.stok += stok.n;
    pb.nilaiSen += nilaiSen;
    perBrand.set(produk.brandId, pb);
  }

  const tidakAdaDiFile = produkAda
    .filter((p) => !terlihat.has(p.skuKunci))
    .map((p) => ({ sku: p.sku, brand: p.brand.nama }));

  return {
    ok: true,
    hasil: {
      namaSheet: baca.namaSheet,
      jumlahBaris: baca.baris.length,
      valid,
      gagal,
      tidakAdaDiFile,
      hppNol,
      perBrand: [...perBrand.values()].sort((a, b) => a.brand.localeCompare(b.brand)),
      totalStok: valid.reduce((s, v) => s + v.stok, 0),
      totalNilaiSen: valid.reduce((s, v) => s + v.nilaiSen, 0),
    },
  };
}
