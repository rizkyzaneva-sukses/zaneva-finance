import { createHash } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { normalisasiTeks } from "@/lib/utils";

type TxClient = Prisma.TransactionClient;

/** Selisih di bawah Rp 1 dianggap cocok — toleransi pembulatan. */
export const TOLERANSI_SALDO = new Prisma.Decimal("1");

/**
 * Kunci anti-duplikat sebuah baris transaksi.
 *
 * Tidak memasukkan rekeningId karena penguncian sudah dilakukan oleh
 * `@@unique([rekeningId, dedupeHash])` di schema — baris yang sama di rekening
 * berbeda tetap boleh masuk.
 */
export function buatDedupeHash(input: {
  tanggalIso: string;
  uangMasuk: Prisma.Decimal | number | string;
  uangKeluar: Prisma.Decimal | number | string;
  keterangan: string;
}): string {
  const payload = [
    input.tanggalIso,
    new Prisma.Decimal(input.uangMasuk).toFixed(2),
    new Prisma.Decimal(input.uangKeluar).toFixed(2),
    normalisasiTeks(input.keterangan),
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Rapikan `urutanInput` supaya mengikuti rantai saldo yang TERCETAK di mutasi bank.
 *
 * Kenapa perlu: `urutanInput` lahir dari urutan unggahan, bukan urutan mutasi.
 * Begitu satu hari diunggah dua kali (atau unggahan kedua masuk belakangan),
 * baris pagi bisa bernomor lebih besar daripada baris sore. Akibatnya saldo
 * berjalan sistem melompat-lompat dan tabel penuh tanda "beda dgn bank",
 * padahal total saldo akhirnya benar.
 *
 * Saldo bank = kebenaran objektif. Untuk tiap tanggal: baris dengan saldo bank
 * `b` berasal dari saldo sebelumnya `b - masuk + keluar`. Rantai disusun mundur
 * dari baris yang saldo sebelumnya tidak dimiliki baris lain (titik awal hari),
 * lalu `urutanInput` dinomori ulang mengikuti rantai itu.
 *
 * Kalau rantai tidak bisa disusun utuh (saldo bank tidak lengkap, atau dua baris
 * berbagi saldo yang sama karena memang kembar), urutan TIDAK diubah — lebih baik
 * dibiarkan daripada salah urut.
 */
export async function rapikanUrutanIkutSaldoBank(
  tx: TxClient,
  rekeningId: string
): Promise<void> {
  const semua = await tx.transaksi.findMany({
    where: { rekeningId },
    select: {
      id: true,
      tanggal: true,
      urutanInput: true,
      uangMasuk: true,
      uangKeluar: true,
      saldoBank: true,
    },
    orderBy: [{ tanggal: "asc" }, { urutanInput: "asc" }, { createdAt: "asc" }],
  });
  if (semua.length === 0) return;

  const perTanggal = new Map<string, typeof semua>();
  for (const t of semua) {
    const kunci = t.tanggal.toISOString().slice(0, 10);
    const daftar = perTanggal.get(kunci);
    if (daftar) daftar.push(t);
    else perTanggal.set(kunci, [t]);
  }

  const urutanBaru = new Map<string, number>();
  // Nomor urut global berjalan supaya tetap unik antar tanggal.
  let nomor = 0;

  for (const kunci of [...perTanggal.keys()].sort()) {
    const daftar = perTanggal.get(kunci)!;
    const bersaldo = daftar.filter((t) => t.saldoBank !== null);
    const tanpaSaldo = daftar.filter((t) => t.saldoBank === null);

    // Baris kembar hasil unggah ulang punya saldo bank yang SAMA PERSIS — bank
    // hanya mencatat satu baris di saldo itu. Untuk menyusun rantai, baris
    // seperti itu dijadikan satu simpul, jadi rantai tetap bisa disusun dan
    // baris kembarnya mendapat nomor urut berdampingan.
    const simpul = new Map<string, typeof bersaldo>();
    for (const t of bersaldo) {
      const kunciSimpul = t.saldoBank!.toFixed(2);
      const isi = simpul.get(kunciSimpul);
      if (isi) isi.push(t);
      else simpul.set(kunciSimpul, [t]);
    }

    // Saldo sebelum tiap simpul, dibulatkan ke sen supaya perbandingan stabil.
    const sebelumnya = new Map<string, string>();
    for (const [kunciSimpul, isi] of simpul) {
      const t = isi[0];
      sebelumnya.set(kunciSimpul, t.saldoBank!.minus(t.uangMasuk).plus(t.uangKeluar).toFixed(2));
    }

    // Baris yang tidak punya saldo bank tidak bisa dipakai membangun rantai.
    // Kalau semua baris hari itu tanpa saldo bank, urutannya dibiarkan apa adanya.
    const satuSimpul = simpul.size < 2;

    if (satuSimpul) {
      for (const t of daftar) urutanBaru.set(t.id, ++nomor);
      continue;
    }

    const titikAwal = [...sebelumnya.entries()].filter(([, prev]) => !simpul.has(prev));
    if (titikAwal.length !== 1) {
      for (const t of daftar) urutanBaru.set(t.id, ++nomor);
      continue;
    }

    const berangkat = new Map<string, string[]>();
    for (const [kunciSimpul, prev] of sebelumnya) {
      const daftarPrev = berangkat.get(prev);
      if (daftarPrev) daftarPrev.push(kunciSimpul);
      else berangkat.set(prev, [kunciSimpul]);
    }

    const urutRantai: string[] = [];
    const dipakai = new Set<string>();
    let sekarang: string | undefined = titikAwal[0][0];
    while (sekarang && !dipakai.has(sekarang)) {
      urutRantai.push(sekarang);
      dipakai.add(sekarang);
      const berikut: string[] = (berangkat.get(sekarang) ?? []).filter((s) => !dipakai.has(s));
      if (berikut.length > 1) break; // rantai bercabang = tidak bisa dipercaya
      sekarang = berikut[0];
    }

    if (urutRantai.length !== simpul.size) {
      for (const t of daftar) urutanBaru.set(t.id, ++nomor);
      continue;
    }
    for (const kunciSimpul of urutRantai) {
      for (const t of simpul.get(kunciSimpul)!) urutanBaru.set(t.id, ++nomor);
    }

    // Baris tanpa saldo bank (mis. pasangan Penjualan/Iklan Shopee yang diinput
    // manual) tidak bisa dibuktikan posisinya di rantai. Taruh di akhir hari itu
    // dengan urutan aslinya — bukan dibuang, dan tidak mengacaukan rantai.
    for (const t of [...tanpaSaldo].sort((a, b) => a.urutanInput - b.urutanInput)) {
      urutanBaru.set(t.id, ++nomor);
    }
  }

  const berubah = semua.filter((t) => urutanBaru.get(t.id) !== t.urutanInput);
  for (const t of berubah) {
    await tx.transaksi.update({
      where: { id: t.id },
      data: { urutanInput: urutanBaru.get(t.id)! },
    });
  }
}

/**
 * Hitung ulang saldo berjalan seluruh transaksi sebuah rekening.
 *
 * Dijalankan penuh (bukan inkremental) setiap kali ada insert/update/delete,
 * karena transaksi bisa masuk dengan tanggal mundur — menyisipkan satu baris
 * lama menggeser saldo semua baris sesudahnya. Pada skala ribuan baris per
 * rekening biayanya tidak signifikan, dan hasilnya selalu konsisten.
 */
export async function hitungUlangSaldo(tx: TxClient, rekeningId: string): Promise<void> {
  // Urutkan dulu mengikuti saldo bank, supaya saldo berjalan yang dihitung
  // sejalan dengan mutasi aslinya (lihat rapikanUrutanIkutSaldoBank).
  await rapikanUrutanIkutSaldoBank(tx, rekeningId);

  const rekening = await tx.rekening.findUniqueOrThrow({
    where: { id: rekeningId },
    select: { saldoAwal: true },
  });

  const transaksi = await tx.transaksi.findMany({
    where: { rekeningId },
    orderBy: [{ tanggal: "asc" }, { urutanInput: "asc" }, { createdAt: "asc" }],
    select: { id: true, uangMasuk: true, uangKeluar: true, saldo: true },
  });

  let berjalan = new Prisma.Decimal(rekening.saldoAwal);
  for (const t of transaksi) {
    berjalan = berjalan.plus(t.uangMasuk).minus(t.uangKeluar);
    // Hanya tulis kalau memang berubah — hemat write saat hitung ulang berulang.
    if (!berjalan.equals(t.saldo)) {
      await tx.transaksi.update({ where: { id: t.id }, data: { saldo: berjalan } });
    }
  }
}

/** Nomor urut berikutnya untuk rekening — penentu urutan di tanggal yang sama. */
export async function urutanInputBerikutnya(tx: TxClient, rekeningId: string): Promise<number> {
  const hasil = await tx.transaksi.aggregate({
    where: { rekeningId },
    _max: { urutanInput: true },
  });
  return (hasil._max.urutanInput ?? 0) + 1;
}

/** Saldo sistem meleset dari saldo yang tertulis di mutasi bank? */
export function saldoMeleset(
  saldoSistem: Prisma.Decimal | null | undefined,
  saldoBank: Prisma.Decimal | null | undefined
): boolean {
  if (!saldoSistem || !saldoBank) return false;
  return new Prisma.Decimal(saldoSistem).minus(saldoBank).abs().gte(TOLERANSI_SALDO);
}
