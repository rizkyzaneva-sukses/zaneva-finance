import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { Role, StatusAcc } from "@/generated/prisma/enums";

export interface PenggunaAktif {
  id: string;
  nama: string;
  username: string;
  role: Role;
  /** Brand yang ditugaskan. null = tidak dibatasi (OWNER, atau belum ada penugasan). */
  brandIds: string[] | null;
  /** Rekening milik brand-brand itu. null = semua rekening. */
  rekeningIds: string[] | null;
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

  // Pembatasan brand: OWNER selalu penuh. Pengguna lain tanpa penugasan = semua brand
  // (sama seperti sebelum fitur ini ada); dengan penugasan = hanya brand-brand itu.
  let brandIds: string[] | null = null;
  let rekeningIds: string[] | null = null;
  if (user.role !== Role.OWNER) {
    const tugas = await prisma.userBrand.findMany({ where: { userId: user.id }, select: { brandId: true } });
    if (tugas.length > 0) {
      brandIds = tugas.map((t) => t.brandId);
      const rek = await prisma.rekening.findMany({ where: { brandId: { in: brandIds } }, select: { id: true } });
      rekeningIds = rek.map((r) => r.id);
    }
  }

  return { id: user.id, nama: user.nama, username: user.username, role: user.role, brandIds, rekeningIds };
}

/*
 * Matriks izin. "Finance" = ADMIN.
 *
 *                              OWNER  ADMIN  STAFF  BENDAHARA
 *  Rekap (upload mutasi bank)    ✓      ✓      ✓       —
 *  Koreksi / input manual        ✓      ✓      ✓*      ✓*      (* butuh ACC)
 *  ACC tahap 1 (verifikasi)      ✓      ✓      —       ✓
 *  ACC final (finance)           ✓      ✓      —       —
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

/** Perubahan oleh role ini perlu disahkan sebelum final. */
export function butuhAcc(role: Role): boolean {
  return role === Role.STAFF || role === Role.BENDAHARA;
}

/**
 * Status ACC awal saat sebuah transaksi dibuat/diubah.
 *
 * - ADMIN/OWNER (Finance): langsung DISETUJUI — menginput berarti memutuskan.
 * - BENDAHARA/STAFF: MENUNGGU verifikasi Bendahara.
 *
 * Pengecualian petty cash & koreksi kode/catatan/split diatur di lib/acc.ts.
 */
export function statusAccUntuk(role: Role): StatusAcc {
  return butuhAcc(role) ? StatusAcc.MENUNGGU : StatusAcc.DISETUJUI;
}

/** ACC tahap 1: verifikasi pekerjaan STAFF/STAF oleh BENDAHARA (atau Finance langsung). */
export function bolehAccBendahara(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER || role === Role.BENDAHARA;
}

/** ACC final (Finance): menyelesaikan koreksi kode/catatan/split. ADMIN = Finance. */
export function bolehAccFinance(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Boleh mengesahkan pekerjaan STAFF/BENDAHARA (tahap mana pun). */
export function bolehAcc(role: Role): boolean {
  return bolehAccBendahara(role);
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

/** Lihat dashboard alokasi dan saldonya. Kuncinya: persentase & jatah laba hanya untuk ADMIN/OWNER. */
export function bolehLihatAlokasi(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Mengesahkan laba bersih bulanan (tutup buku) dan membatalkannya. Dasar semua pembagian alokasi, jadi hanya OWNER. */
export function bolehTutupBuku(role: Role): boolean {
  return role === Role.OWNER;
}

/** Mengesahkan pembagian jatah alokasi dari laba yang sudah disahkan OWNER. ADMIN = Finance. */
export function bolehDistribusiAlokasi(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Membatalkan distribusi yang sudah disahkan. Sengaja lebih tinggi dari mengesahkan. */
export function bolehBatalkanDistribusi(role: Role): boolean {
  return role === Role.OWNER;
}

export const bolehLihatLog = bolehKelolaPengguna;
