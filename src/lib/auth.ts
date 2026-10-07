import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Role, StatusAcc } from "@/generated/prisma/enums";

export interface PenggunaAktif {
  id: string;
  nama: string;
  username: string;
  role: Role;
}

/**
 * Role selalu dibaca fresh dari DB, tidak dari isi cookie — supaya pencabutan
 * akses atau penurunan role langsung berlaku tanpa menunggu session kedaluwarsa.
 */
export async function getPenggunaAktif(): Promise<PenggunaAktif | null> {
  const session = await getSession();
  if (!session.userId) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, nama: true, username: true, role: true, aktif: true },
  });
  if (!user || !user.aktif) return null;

  return { id: user.id, nama: user.nama, username: user.username, role: user.role };
}

/*
 * Matriks izin. "Finance" = ADMIN.
 *
 *                              OWNER  ADMIN  STAFF  BENDAHARA
 *  Rekap (upload mutasi bank)    ✓      ✓      ✓       —
 *  Koreksi / input manual        ✓      ✓      ✓*      ✓*      (* butuh ACC)
 *  ACC koreksi                   ✓      ✓      —       —
 *  Hapus transaksi, master data  ✓      ✓      —       —
 *  Dashboard & Laporan           ✓      ✓      ✓       —
 *  Kelola pengguna, lihat Log    ✓      —      —       —
 */

/** Upload mutasi bank, parsing, dan simpan rekap. BENDAHARA tidak: kas tunai tidak punya mutasi bank. */
export function bolehRekap(role: Role): boolean {
  return role !== Role.BENDAHARA;
}

/** Koreksi kode/catatan, split, dan input manual. */
export function bolehInput(): boolean {
  return true;
}

/** Perubahan oleh role ini perlu disahkan ADMIN/OWNER sebelum final. */
export function butuhAcc(role: Role): boolean {
  return role === Role.STAFF || role === Role.BENDAHARA;
}

export function statusAccUntuk(role: Role): StatusAcc {
  return butuhAcc(role) ? StatusAcc.MENUNGGU : StatusAcc.DISETUJUI;
}

/** Boleh mengesahkan pekerjaan STAFF/BENDAHARA. */
export function bolehAcc(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Boleh hapus transaksi dan kelola master data (rekening, kode akun). */
export function bolehKelola(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Dashboard, Laporan, export. */
export function bolehLihatLaporan(role: Role): boolean {
  return role !== Role.BENDAHARA;
}

/** Kelola akun pengguna dan lihat log perubahan. */
export function bolehKelolaPengguna(role: Role): boolean {
  return role === Role.OWNER;
}

export const bolehLihatLog = bolehKelolaPengguna;
