import type { Prisma } from "@/generated/prisma/client";
import { Bank, Role, StatusAcc } from "@/generated/prisma/enums";
import { butuhAcc, type PenggunaAktif } from "@/lib/auth";

/*
 * Aturan ACC transaksi. "Finance" = ADMIN / OWNER.
 * Bendahara tidak meng-ACC mutasi bank. Tugasnya hanya mencatat petty cash.
 *
 * 1. Input baru hasil mutasi bank (unggahan screenshot/PDF) → DISETUJUI.
 *    Menyimpan pertama kali bukan koreksi, dan angkanya sudah dibuktikan
 *    dokumen bank.
 * 2. Input MANUAL (lewat "Tambah Transaksi") oleh STAFF/BENDAHARA →
 *    PERLU_FINANCE. Baris manual tidak punya dokumen bank yang membuktikannya
 *    — mis. Penjualan Shopee 10 juta yang sudah dipotong auto-debit iklan.
 *    Angka seperti ini menentukan laba kotor & biaya iklan, jadi harus
 *    disahkan Finance sebelum dianggap final.
 * 3. ADMIN/OWNER menginput → DISETUJUI; menginput berarti memutuskan.
 * 4. Koreksi rekening bank oleh Bendahara/Staff → PERLU_FINANCE.
 *    Koreksi petty cash yang menyentuh kode akun, catatan, atau split
 *    juga PERLU_FINANCE. Koreksi ringan petty cash tetap DISETUJUI.
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
 *
 * - Hasil unggahan mutasi bank (`sumber` SCREENSHOT/PDF) → DISETUJUI. Angkanya
 *   sudah dibuktikan dokumen bank; menyimpan pertama kali bukan koreksi.
 * - Input MANUAL (Tambah Transaksi) oleh STAFF/BENDAHARA → PERLU_FINANCE.
 *   Baris ini tidak punya dokumen bank yang membuktikannya, padahal bisa
 *   menentukan laba kotor & biaya iklan. Harus disahkan Finance dulu.
 * - ADMIN/OWNER menginput manual → DISETUJUI; menginput berarti memutuskan.
 */
export function fieldAccUntukInput(
  user: Pick<PenggunaAktif, "id" | "role">,
  _bank: Bank,
  sumber?: string
): FieldAcc {
  if (sumber === "MANUAL" && butuhAcc(user.role)) {
    return { statusAcc: StatusAcc.PERLU_FINANCE, accOlehId: null, accPada: null };
  }
  return { statusAcc: StatusAcc.DISETUJUI, accOlehId: user.id, accPada: new Date() };
}

/**
 * Field ACC yang harus ikut ditulis setiap kali transaksi DIKOREKSI.
 *
 * - ADMIN/OWNER mengubah → langsung DISETUJUI atas nama dirinya.
 * - Bendahara/Staff mengubah rekening bank → PERLU_FINANCE.
 * - Bendahara/Staff mengubah petty cash:
 *     · menyentuh kode akun / catatan / split → PERLU_FINANCE
 *     · koreksi ringan                         → tetap DISETUJUI
 */
export function fieldAccUntukPerubahan(
  user: Pick<PenggunaAktif, "id" | "role">,
  bank: Bank,
  sentuhPenting = false,
  accOlehId: string | null = null
): Prisma.TransaksiUpdateInput {
  const setujui: Prisma.TransaksiUpdateInput = {
    statusAcc: StatusAcc.DISETUJUI,
    accOleh: { connect: { id: user.id } },
    accPada: new Date(),
  };
  if (!butuhAcc(user.role)) return setujui;
  if (inputPettyCashTanpaAcc(bank) && !sentuhPenting) return setujui;
  return {
    statusAcc: StatusAcc.PERLU_FINANCE,
    // Putus hanya kalau memang ada. Disconnect pada relasi kosong membuat Prisma melempar.
    ...(accOlehId ? { accOleh: { disconnect: true as const } } : {}),
    accPada: null,
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
