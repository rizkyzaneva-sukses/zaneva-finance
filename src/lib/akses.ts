import type { Prisma } from "@/generated/prisma/client";
import type { PenggunaAktif } from "@/lib/auth";

/**
 * Pembatasan akses per brand. Brand dihubungkan lewat rekening, jadi pembatasan
 * pada akhirnya adalah "rekening mana yang boleh disentuh pengguna ini".
 *
 * - `user.rekeningIds === null`  → tidak dibatasi (OWNER, atau belum ada penugasan)
 * - selain itu                   → hanya rekening-rekening dalam daftar
 */

export const dibatasi = (u: Pick<PenggunaAktif, "brandIds">) => u.brandIds !== null;

export function bolehRekening(u: Pick<PenggunaAktif, "rekeningIds">, rekeningId: string): boolean {
  return u.rekeningIds === null || u.rekeningIds.includes(rekeningId);
}

export function bolehBrand(u: Pick<PenggunaAktif, "brandIds">, brandId: string | null | undefined): boolean {
  if (u.brandIds === null) return true;
  return brandId ? u.brandIds.includes(brandId) : false;
}

/** Tambahkan batas rekening ke filter transaksi (tanpa menimpa filter yang sudah ada). */
export function batasiTransaksi(
  where: Prisma.TransaksiWhereInput,
  u: Pick<PenggunaAktif, "rekeningIds">
): Prisma.TransaksiWhereInput {
  if (u.rekeningIds === null) return where;
  const dan = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  return { ...where, AND: [...dan, { rekeningId: { in: u.rekeningIds } }] };
}
