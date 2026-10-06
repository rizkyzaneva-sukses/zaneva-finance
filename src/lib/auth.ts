import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Role } from "@/generated/prisma/enums";

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

const HIERARKI: Record<Role, number> = {
  [Role.VIEWER]: 0,
  [Role.STAFF]: 1,
  [Role.ADMIN]: 2,
  [Role.OWNER]: 3,
};

export function punyaMinimalRole(role: Role, minimal: Role): boolean {
  return HIERARKI[role] >= HIERARKI[minimal];
}

/** Boleh upload, koreksi kode & catatan, simpan rekap. */
export function bolehInput(role: Role): boolean {
  return punyaMinimalRole(role, Role.STAFF);
}

/** Boleh hapus transaksi & kelola master data. */
export function bolehKelola(role: Role): boolean {
  return punyaMinimalRole(role, Role.ADMIN);
}

/** Boleh kelola akun pengguna. */
export function bolehKelolaPengguna(role: Role): boolean {
  return role === Role.OWNER;
}
