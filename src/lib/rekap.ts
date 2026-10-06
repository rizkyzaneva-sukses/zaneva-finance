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
 * Hitung ulang saldo berjalan seluruh transaksi sebuah rekening.
 *
 * Dijalankan penuh (bukan inkremental) setiap kali ada insert/update/delete,
 * karena transaksi bisa masuk dengan tanggal mundur — menyisipkan satu baris
 * lama menggeser saldo semua baris sesudahnya. Pada skala ribuan baris per
 * rekening biayanya tidak signifikan, dan hasilnya selalu konsisten.
 */
export async function hitungUlangSaldo(tx: TxClient, rekeningId: string): Promise<void> {
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
