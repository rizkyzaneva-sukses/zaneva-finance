import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rp 1.250.000 — tanpa desimal, untuk ringkasan & dashboard */
export function formatRupiah(nilai: number | string | null | undefined): string {
  const angka = Number(nilai ?? 0);
  if (!Number.isFinite(angka)) return "Rp 0";
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(angka);
}

/** 1.250.000,50 — dua desimal, untuk tabel transaksi & Excel */
export function formatAngka(nilai: number | string | null | undefined, desimal = 2): string {
  const angka = Number(nilai ?? 0);
  if (!Number.isFinite(angka)) return "0";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(angka);
}

const BULAN_PENDEK = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
  "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/**
 * "6 Okt 2026" — dibaca pakai getter UTC, bukan lokal.
 *
 * Kolom `tanggal` bertipe DATE di Postgres dan dikembalikan Prisma sebagai
 * tengah malam UTC. Kalau diformat pakai getter lokal (WIB = UTC+7) tanggalnya
 * tetap benar, tapi di timezone negatif akan mundur sehari. UTC selalu aman.
 */
export function formatTanggal(nilai: Date | string | null | undefined): string {
  if (!nilai) return "";
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCDate()} ${BULAN_PENDEK[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-10-06" dalam UTC — untuk value input[type=date] dan dedupe key */
export function tanggalKeIso(nilai: Date | string | null | undefined): string {
  if (!nilai) return "";
  const d = nilai instanceof Date ? nilai : new Date(nilai);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/** Bikin Date tengah malam UTC dari komponen tanggal — hindari geser timezone */
export function tanggalUtc(tahun: number, bulanIndex: number, hari: number): Date {
  return new Date(Date.UTC(tahun, bulanIndex, hari));
}

const PETA_BULAN: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1, pebruari: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, ags: 7, agt: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9,
  nov: 10, november: 10, nop: 10, nopember: 10,
  des: 11, dec: 11, desember: 11, december: 11,
};

/**
 * Normalisasi tanggal apa adanya dari hasil OCR jadi Date (UTC).
 *
 * Menangani: "1 November 2023", "02 Okt 2026", "1 October 2026 10:23:45",
 * "01/10/2026", "01-10-2026", "2026-10-01". Mengembalikan null kalau tidak
 * terbaca — pemanggil yang memutuskan, jangan pernah menebak tanggal.
 */
export function parseTanggalIndo(teks: string): Date | null {
  const bersih = teks.trim().replace(/\s+/g, " ");
  if (!bersih) return null;

  // ISO: 2026-10-01
  const iso = bersih.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const [, y, m, d] = iso;
    return tanggalUtc(Number(y), Number(m) - 1, Number(d));
  }

  // Nama bulan: "1 November 2023", "02 Okt 2026 10:23"
  const namaBulan = bersih.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})/);
  if (namaBulan) {
    const [, d, nama, y] = namaBulan;
    const bulan = PETA_BULAN[nama.toLowerCase()];
    if (bulan === undefined) return null;
    return tanggalUtc(Number(y), bulan, Number(d));
  }

  // Numerik dd/mm/yyyy atau dd-mm-yyyy
  const numerik = bersih.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (numerik) {
    const [, d, m, y] = numerik;
    return tanggalUtc(Number(y), Number(m) - 1, Number(d));
  }

  return null;
}

/** Normalisasi teks untuk dedupe: lowercase + spasi dirapikan */
export function normalisasiTeks(teks: string): string {
  return teks.toLowerCase().replace(/\s+/g, " ").trim();
}
