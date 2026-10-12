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
    select: { id: true, nama: true, username: true, role: true, aktif: true, tokenSesi: true },
  });
  if (!user || !user.aktif) return null;
  // Cookie tanpa angka ini dibuat sebelum kolom ada — anggap 0 supaya sesi yang sah tidak putus.
  if ((session.tokenSesi ?? 0) !== user.tokenSesi) return null;

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
 *  Rekap (upload mutasi bank)    ✓      ✓      ✓*      —       (* bank menunggu ACC Finance)
 *  Koreksi / input manual        ✓      ✓      ✓*      ✓*      (* bank & koreksi kode menunggu Finance;
 *                                                              input petty cash langsung masuk)
 *  ACC mutasi bank (Finance)     ✓      ✓      —       —
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
 * Status ACC awal untuk stok opname.
 *
 * - ADMIN/OWNER: langsung DISETUJUI.
 * - STAFF/BENDAHARA: MENUNGGU. Di halaman Stok ini disahkan Finance, bukan Bendahara.
 *
 * Transaksi bank tidak memakai fungsi ini. Aturannya ada di lib/acc.ts.
 */
export function statusAccUntuk(role: Role): StatusAcc {
  return butuhAcc(role) ? StatusAcc.MENUNGGU : StatusAcc.DISETUJUI;
}

/**
 * Menyetujui sisa status MENUNGGU (data lama, sebelum antrean bank pindah ke Finance).
 * Mutasi bank yang baru tidak lagi masuk status ini.
 */
export function bolehAccBendahara(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER || role === Role.BENDAHARA;
}

/** ACC mutasi bank dan koreksi yang menunggu Finance. ADMIN = Finance. */
export function bolehAccFinance(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Menandai penjualan kode 400 sebagai Verified atau mengosongkannya lagi. */
export function bolehVerifikasiPenjualan(role: Role): boolean {
  return role === Role.STAFF || role === Role.ADMIN || role === Role.OWNER;
}

/** Boleh mengesahkan sisa status MENUNGGU. ACC mutasi bank memakai bolehAccFinance. */
export function bolehAcc(role: Role): boolean {
  return bolehAccBendahara(role);
}

/** Boleh hapus transaksi dan kelola master data (rekening, kode akun). */
export function bolehKelola(role: Role): boolean {
  return role === Role.ADMIN || role === Role.OWNER;
}

/** Jurnal penyesuaian tidak menggerakkan bank. Hanya Finance (ADMIN) dan OWNER. */
export function bolehJurnalPenyesuaian(role: Role): boolean {
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
