import type { Prisma } from "@/generated/prisma/client";
import { Bank, Role, StatusAcc } from "@/generated/prisma/enums";
import { butuhAcc, type PenggunaAktif } from "@/lib/auth";

/**
 * Field ACC yang harus ikut ditulis setiap kali transaksi diubah.
 *
 * - STAFF/BENDAHARA mengubah → kembali MENUNGGU, jejak ACC lama dihapus
 *   (perubahan baru harus disahkan ulang, walau sebelumnya sudah disetujui).
 * - ADMIN/OWNER mengubah → langsung DISETUJUI atas nama dirinya; mengubah
 *   berarti memutuskan, tidak perlu menunggu ACC dari diri sendiri.
 */
export function dataAccUntukPerubahan(user: Pick<PenggunaAktif, "id" | "role">) {
  if (butuhAcc(user.role)) {
    return {
      statusAcc: StatusAcc.MENUNGGU,
      accOleh: { disconnect: true },
      accPada: null,
    } satisfies Prisma.TransaksiUpdateInput;
  }
  return {
    statusAcc: StatusAcc.DISETUJUI,
    accOleh: { connect: { id: user.id } },
    accPada: new Date(),
  } satisfies Prisma.TransaksiUpdateInput;
}

/**
 * BENDAHARA hanya boleh menyentuh rekening kas tunai (petty cash).
 * Belum ada penugasan per-kas (mis. Kas Gudang vs Kas Office) — semua petty
 * cash terlihat oleh semua bendahara.
 */
export function bolehAksesRekening(role: Role, bank: Bank): boolean {
  return role !== Role.BENDAHARA || bank === Bank.PETTY_CASH;
}
