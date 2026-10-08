import type { Prisma } from "@/generated/prisma/client";
import { Bank, Role, StatusAcc } from "@/generated/prisma/enums";
import { butuhAcc, type PenggunaAktif } from "@/lib/auth";

/*
 * Aturan ACC transaksi. "Finance" = ADMIN.
 *
 * 1. Input manual PETTY CASH oleh Bendahara/Staff → langsung DISETUJUI
 *    (kas kecil operasional, tidak perlu dikunci ACC).
 * 2. Input lain oleh Bendahara/Staff → MENUNGGU (verifikasi Bendahara).
 * 3. Koreksi APA PUN oleh Bendahara/Staff → MENUNGGU.
 *    - Bila menyentuh KODE AKUN, CATATAN, atau SPLIT → PERLU_FINANCE
 *      (Bendahara sudah beres, tapi butuh finalisasi Finance).
 * 4. ADMIN/OWNER (Finance) mengubah → DISETUJUI; mengubah berarti memutuskan.
 */

/** Field ACC (skalar) yang ditulis bersama transaksi. */
export interface FieldAcc {
  statusAcc: StatusAcc;
  accOlehId: string | null;
  accPada: Date | null;
}

/** Input manual ke rekening petty cash bebas ACC — kas kecil, bukan rekening bank. */
export function inputPettyCashTanpaAcc(bank: Bank): boolean {
  return bank === Bank.PETTY_CASH;
}

/**
 * Field ACC untuk transaksi BARU.
 * Petty cash oleh Bendahara/Staff langsung disetujui; selebihnya mengikuti role.
 */
export function fieldAccUntukInput(user: Pick<PenggunaAktif, "id" | "role">, bank: Bank): FieldAcc {
  if (butuhAcc(user.role) && inputPettyCashTanpaAcc(bank)) {
    return { statusAcc: StatusAcc.DISETUJUI, accOlehId: user.id, accPada: new Date() };
  }
  if (butuhAcc(user.role)) {
    return { statusAcc: StatusAcc.MENUNGGU, accOlehId: null, accPada: null };
  }
  return { statusAcc: StatusAcc.DISETUJUI, accOlehId: user.id, accPada: new Date() };
}

/**
 * Field ACC yang harus ikut ditulis setiap kali transaksi DIKOREKSI.
 *
 * - ADMIN/OWNER mengubah → langsung DISETUJUI atas nama dirinya.
 * - Bendahara/Staff mengubah → jejak ACC lama dihapus & disahkan ulang:
 *     · menyentuh kode akun / catatan / split → PERLU_FINANCE (final Finance)
 *     · koreksi biasa (mis. `yakin`)          → MENUNGGU (verifikasi Bendahara)
 */
export function fieldAccUntukPerubahan(
  user: Pick<PenggunaAktif, "id" | "role">,
  sentuhPenting = false
): Prisma.TransaksiUpdateInput {
  if (butuhAcc(user.role)) {
    return {
      statusAcc: sentuhPenting ? StatusAcc.PERLU_FINANCE : StatusAcc.MENUNGGU,
      accOleh: { disconnect: true },
      accPada: null,
    };
  }
  return {
    statusAcc: StatusAcc.DISETUJUI,
    accOleh: { connect: { id: user.id } },
    accPada: new Date(),
  };
}

/**
 * BENDAHARA hanya boleh menyentuh rekening kas tunai (petty cash).
 * Belum ada penugasan per-kas (mis. Kas Gudang vs Kas Office) — semua petty
 * cash terlihat oleh semua bendahara.
 */
export function bolehAksesRekening(role: Role, bank: Bank): boolean {
  return role !== Role.BENDAHARA || bank === Bank.PETTY_CASH;
}
