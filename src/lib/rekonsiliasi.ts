import { Prisma } from "@/generated/prisma/client";

/**
 * Rekonsiliasi saldo per HARI, bukan per baris.
 *
 * Kenapa perlu: badge "beda dgn bank" dulu dipasang per baris dengan
 * membandingkan `saldo` berjalan vs `saldoBank` baris itu. Cara itu rapuh,
 * karena `saldo` berjalan bergantung pada URUTAN baris di dalam satu hari —
 * dan urutan itu tidak selalu bisa diketahui (screenshot mobile banking sering
 * tidak mencetak saldo berjalan, dan OCR kadang gagal membaca sebagian baris).
 *
 * Akibatnya satu baris yang salah urutan membuat SEMUA baris sesudahnya di hari
 * itu ikut bertanda "beda dgn bank", padahal total akhir hari sudah cocok
 * dengan mutasi bank. Di data produksi ini menghasilkan 109 badge palsu.
 *
 * Aturan yang dipakai sekarang:
 *
 * 1. **Rantai utuh** — semua posisi baris bisa dibuktikan lewat rantai saldo
 *    bank (tautan "saldo sebelumnya" membentuk satu garis lurus, tidak
 *    bercabang). Badge per baris dipercaya.
 *
 * 2. **Rantai tidak utuh** — saldo bank tidak lengkap atau bercabang. Posisi
 *    tiap baris tidak bisa dibuktikan, jadi badge per baris DIMATIKAN. Yang
 *    dilaporkan hanya rekonsiliasi tingkat hari: saldo akhir hari menurut
 *    sistem vs saldo ujung rantai bank. Satu tanda untuk satu hari, bukan
 *    puluhan tanda yang menyesatkan.
 */

export type BarisRekonsiliasi = {
  id: string;
  uangMasuk: Prisma.Decimal;
  uangKeluar: Prisma.Decimal;
  saldoBank: Prisma.Decimal | null;
  /**
   * `MANUAL` = baris yang diinput lewat "Tambah Transaksi", bukan hasil baca
   * mutasi bank. Contoh nyata: pencairan Shopee Rp 10.000.000 yang sudah
   * dipotong auto-debit, jadi yang masuk rekening bersih. Tim mencatatnya
   * sebagai Penjualan Shopee (masuk) + Iklan Shopee (keluar) supaya laba kotor
   * dan biaya iklan tetap terlihat.
   *
   * Baris seperti ini MEMANG TIDAK ADA di mutasi bank, jadi membandingkannya
   * dengan saldo bank selalu salah. Dia dikecualikan dari rekonsiliasi.
   */
  sumber?: string;
};

export type AnalisaHari = {
  /** Data bank hari itu cukup untuk memvonis cocok/tidak. */
  sah: boolean;
  /** Kenapa tidak sah — untuk tooltip & log. */
  alasan: string | null;
  /** Net hari itu menurut sistem (Σ masuk − Σ keluar). */
  netSistem: Prisma.Decimal;
  /** Net hari itu menurut mutasi bank (saldo akhir − saldo awal). */
  netBank: Prisma.Decimal | null;
  /** netSistem − netBank. null kalau data bank tidak sah. */
  selisih: Prisma.Decimal | null;
};

const sen = (d: Prisma.Decimal) => d.toFixed(2);

/**
 * Analisa satu hari transaksi sebuah rekening.
 *
 * Hanya baris yang berasal dari mutasi bank (SCREENSHOT/PDF) yang direkonsiliasi.
 * Baris `MANUAL` — mis. Penjualan/Iklan/Koin Shopee yang diinput lewat "Tambah
 * Transaksi" karena pencairan Shopee sudah dipotong auto-debit — memang TIDAK
 * ADA di mutasi, jadi membandingkannya dengan saldo bank selalu salah.
 *
 * Yang dibandingkan adalah NET hari itu (Σ masuk − Σ keluar) terhadap NET
 * mutasi bank (saldo akhir − saldo awal). Bukan saldo kumulatif: kalau
 * kumulatif, satu hari yang bolong membuat semua hari sesudahnya terlihat beda.
 */
export function analisaHari(baris: BarisRekonsiliasi[]): AnalisaHari {
  const bank = baris.filter((b) => b.sumber !== "MANUAL");
  const net = bank.reduce(
    (akumulasi, b) => akumulasi.plus(b.uangMasuk).minus(b.uangKeluar),
    new Prisma.Decimal(0)
  );

  if (bank.length === 0) {
    return {
      sah: false,
      alasan: "hari ini hanya berisi transaksi manual (tidak ada di mutasi bank)",
      netSistem: net,
      netBank: null,
      selisih: null,
    };
  }

  const bersaldo = bank.filter((b) => b.saldoBank !== null);
  if (bersaldo.length === 0) {
    return {
      sah: false,
      alasan: "tidak ada saldo bank di hari ini",
      netSistem: net,
      netBank: null,
      selisih: null,
    };
  }

  // Syarat sah: setiap baris BANK hari itu punya saldo bank. Kalau ada satu
  // saja yang tidak terbaca (screenshot mobile banking sering tidak mencetak
  // saldo berjalan), net bank tidak bisa dihitung dan hari itu tidak divonis.
  if (bersaldo.length !== bank.length) {
    return {
      sah: false,
      alasan: `${bank.length - bersaldo.length} baris mutasi tanpa saldo bank`,
      netSistem: net,
      netBank: null,
      selisih: null,
    };
  }

  // Rantai harus utuh: saldo-sebelum tiap baris harus menjadi saldo baris lain
  // hari itu (kecuali satu titik awal), dan hanya ada satu titik akhir.
  const saldoSet = new Set<string>();
  for (const b of bersaldo) saldoSet.add(sen(b.saldoBank!));

  const sebelumSet = new Set<string>();
  for (const b of bersaldo) {
    sebelumSet.add(sen(b.saldoBank!.minus(b.uangMasuk).plus(b.uangKeluar)));
  }

  const titikAwal: string[] = [];
  sebelumSet.forEach((p) => {
    if (!saldoSet.has(p)) titikAwal.push(p);
  });
  const titikAkhir: string[] = [];
  saldoSet.forEach((s) => {
    if (!sebelumSet.has(s)) titikAkhir.push(s);
  });

  if (titikAwal.length !== 1 || titikAkhir.length !== 1) {
    return {
      sah: false,
      alasan:
        titikAwal.length !== 1
          ? `${titikAwal.length} titik awal — ada baris mutasi yang hilang`
          : `${titikAkhir.length} titik akhir`,
      netSistem: net,
      netBank: null,
      selisih: null,
    };
  }

  const netBank = new Prisma.Decimal(titikAkhir[0]).minus(new Prisma.Decimal(titikAwal[0]));
  return {
    sah: true,
    alasan: null,
    netSistem: net,
    netBank,
    selisih: net.minus(netBank),
  };
}

/**
 * Baris mana yang layak diberi badge "beda dgn bank".
 *
 * Hanya kalau net hari itu **terbukti** beda: semua baris hari itu punya saldo
 * bank DAN rantai saldonya utuh. Kalau data bank tidak lengkap, badge tidak
 * dipasang — lebih baik diam daripada menuduh salah.
 *
 * Satu tanda untuk satu hari, di baris terakhir. Menandai per baris membuat
 * satu hari bermasalah tampak seperti puluhan kesalahan.
 */
export function tentukanBadge(
  baris: { id: string }[],
  analisa: AnalisaHari,
  toleransi: Prisma.Decimal
): Set<string> {
  const hasil = new Set<string>();
  if (!analisa.sah) return hasil;
  if (analisa.selisih === null) return hasil;
  if (analisa.selisih.abs().lessThan(toleransi)) return hasil;
  if (baris.length === 0) return hasil;

  hasil.add(baris[baris.length - 1].id);
  return hasil;
}

/**
 * Hitung badge "beda dgn bank" untuk SEMUA baris satu rekening.
 *
 * Perlu seluruh baris rekening (bukan hanya yang tampil di satu halaman)
 * karena rekonsiliasi bekerja per hari: saldo awal hari bergantung pada hari
 * sebelumnya, dan rantai saldo bank hanya bisa disusun kalau semua baris hari
 * itu ikut diperiksa.
 */
export function hitungBadgeRekening(
  semua: {
    id: string;
    tanggal: Date;
    urutanInput: number;
    uangMasuk: Prisma.Decimal;
    uangKeluar: Prisma.Decimal;
    saldo: Prisma.Decimal;
    saldoBank: Prisma.Decimal | null;
  }[],
  saldoAwal: Prisma.Decimal,
  toleransi: Prisma.Decimal
): Set<string> {
  const hasil = new Set<string>();
  const perTanggal = new Map<string, typeof semua>();
  for (const t of semua) {
    const kunci = t.tanggal.toISOString().slice(0, 10);
    const daftar = perTanggal.get(kunci);
    if (daftar) daftar.push(t);
    else perTanggal.set(kunci, [t]);
  }

  void saldoAwal;
  for (const kunci of [...perTanggal.keys()].sort()) {
    const daftar = [...perTanggal.get(kunci)!].sort((a, b) => a.urutanInput - b.urutanInput);
    const analisa = analisaHari(daftar);
    for (const id of tentukanBadge(daftar, analisa, toleransi)) hasil.add(id);
  }

  return hasil;
}
