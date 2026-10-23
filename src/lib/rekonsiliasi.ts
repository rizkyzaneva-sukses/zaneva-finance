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
};

export type AnalisaHari = {
  /** Rantai saldo bank utuh, urutan baris bisa dibuktikan. */
  koheren: boolean;
  /** Urutan id baris mengikuti rantai saldo bank. null = tidak bisa disusun. */
  urutanRantai: string[] | null;
  /** Saldo akhir hari menurut ujung rantai bank. null = tidak ada saldo bank. */
  saldoAkhirBank: Prisma.Decimal | null;
  /** Saldo akhir hari menurut hitungan sistem (saldo awal + net hari itu). */
  saldoAkhirSistem: Prisma.Decimal;
  /** saldoAkhirSistem - saldoAkhirBank. null kalau saldo bank tidak ada. */
  selisih: Prisma.Decimal | null;
  /** Saldo bank terbaca di hari itu? */
  adaSaldoBank: boolean;
};

const sen = (d: Prisma.Decimal) => d.toFixed(2);

/**
 * Analisa satu hari transaksi sebuah rekening.
 *
 * `sebelum` = saldo sistem sebelum hari itu dimulai.
 */
export function analisaHari(
  baris: BarisRekonsiliasi[],
  sebelum: Prisma.Decimal
): AnalisaHari {
  const net = baris.reduce(
    (akumulasi, b) => akumulasi.plus(b.uangMasuk).minus(b.uangKeluar),
    new Prisma.Decimal(0)
  );
  const saldoAkhirSistem = sebelum.plus(net);

  const bersaldo = baris.filter((b) => b.saldoBank !== null);
  if (bersaldo.length === 0) {
    return {
      koheren: false,
      urutanRantai: null,
      saldoAkhirBank: null,
      saldoAkhirSistem,
      selisih: null,
      adaSaldoBank: false,
    };
  }

  // Simpul = saldo bank. Dua baris dengan saldo bank sama persis adalah baris
  // kembar (unggahan ulang) — bank hanya mencatat satu baris di saldo itu, jadi
  // keduanya duduk di simpul yang sama.
  const simpul = new Map<string, BarisRekonsiliasi[]>();
  for (const b of bersaldo) {
    const kunci = sen(b.saldoBank!);
    const isi = simpul.get(kunci);
    if (isi) isi.push(b);
    else simpul.set(kunci, [b]);
  }

  // Saldo sebelum tiap simpul: saldoBank - masuk + keluar.
  const sebelumnya = new Map<string, string>();
  simpul.forEach((isi, kunci) => {
    const b = isi[0];
    sebelumnya.set(kunci, sen(b.saldoBank!.minus(b.uangMasuk).plus(b.uangKeluar)));
  });

  // Ujung rantai = saldo bank yang tidak menjadi "saldo sebelumnya" simpul lain.
  const semuaPrev = new Set<string>();
  sebelumnya.forEach((prev) => semuaPrev.add(prev));
  const ujung: string[] = [];
  simpul.forEach((_isi, kunci) => {
    if (!semuaPrev.has(kunci)) ujung.push(kunci);
  });
  const saldoAkhirBank = ujung.length === 1 ? new Prisma.Decimal(ujung[0]) : null;

  const hasil = (
    koheren: boolean,
    urutanRantai: string[] | null,
    akhirBank: Prisma.Decimal | null
  ): AnalisaHari => ({
    koheren,
    urutanRantai,
    saldoAkhirBank: akhirBank,
    saldoAkhirSistem,
    selisih: akhirBank === null ? null : saldoAkhirSistem.minus(akhirBank),
    adaSaldoBank: true,
  });

  if (simpul.size < 2) {
    // Satu simpul saja: tidak ada rantai yang perlu disusun.
    return hasil(true, baris.map((b) => b.id), saldoAkhirBank);
  }

  // Titik awal hari = saldo sebelum sebuah simpul yang bukan saldo simpul lain.
  const titikAwal: string[] = [];
  sebelumnya.forEach((prev, kunci) => {
    if (!simpul.has(prev)) titikAwal.push(kunci);
  });
  if (titikAwal.length !== 1) {
    return hasil(false, null, saldoAkhirBank);
  }

  const berangkat = new Map<string, string[]>();
  sebelumnya.forEach((prev, kunci) => {
    const daftar = berangkat.get(prev);
    if (daftar) daftar.push(kunci);
    else berangkat.set(prev, [kunci]);
  });

  const rantai: string[] = [];
  const dipakai = new Set<string>();
  let sekarang: string | undefined = titikAwal[0];
  while (sekarang && !dipakai.has(sekarang)) {
    rantai.push(sekarang);
    dipakai.add(sekarang);
    const berikut: string[] = (berangkat.get(sekarang) ?? []).filter((s) => !dipakai.has(s));
    if (berikut.length > 1) return hasil(false, null, saldoAkhirBank);
    sekarang = berikut[0];
  }

  if (rantai.length !== simpul.size) {
    return hasil(false, null, saldoAkhirBank);
  }

  // Urutan akhir: baris bersaldo mengikuti rantai, baris tanpa saldo bank
  // (mis. pasangan manual Penjualan/Iklan Shopee) ditaruh di belakang.
  const urutanRantai: string[] = [];
  for (const kunci of rantai) {
    for (const b of simpul.get(kunci)!) urutanRantai.push(b.id);
  }
  for (const b of baris) {
    if (b.saldoBank === null) urutanRantai.push(b.id);
  }

  return hasil(true, urutanRantai, new Prisma.Decimal(rantai[rantai.length - 1]));
}

/**
 * Baris mana yang layak diberi badge "beda dgn bank".
 *
 * - Rantai utuh: badge per baris apa adanya (selisih nyata).
 * - Rantai tidak utuh: badge per baris dimatikan. Hanya baris terakhir hari itu
 *   yang ditandai kalau saldo akhir hari memang meleset — satu-satunya angka
 *   yang bisa dipertanggungjawabkan dari data yang bolong.
 */
export function tentukanBadge(
  baris: { id: string; saldo: Prisma.Decimal; saldoBank: Prisma.Decimal | null }[],
  analisa: AnalisaHari,
  toleransi: Prisma.Decimal
): Set<string> {
  const hasil = new Set<string>();

  if (!analisa.adaSaldoBank) return hasil;

  if (analisa.koheren) {
    for (const b of baris) {
      if (b.saldoBank === null) continue;
      if (b.saldo.minus(b.saldoBank).abs().greaterThanOrEqualTo(toleransi)) {
        hasil.add(b.id);
      }
    }
    return hasil;
  }

  // Rantai tidak utuh. Hanya satu tanda untuk hari itu, di baris terakhir.
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

  let berjalan = saldoAwal;
  for (const kunci of [...perTanggal.keys()].sort()) {
    const daftar = [...perTanggal.get(kunci)!].sort((a, b) => a.urutanInput - b.urutanInput);
    const sebelum = berjalan;
    berjalan = daftar.reduce(
      (akumulasi, t) => akumulasi.plus(t.uangMasuk).minus(t.uangKeluar),
      sebelum
    );

    const analisa = analisaHari(daftar, sebelum);
    for (const id of tentukanBadge(daftar, analisa, toleransi)) hasil.add(id);
  }

  return hasil;
}
