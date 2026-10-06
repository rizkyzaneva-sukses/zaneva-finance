import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Rp 1.250.000 — tanpa desimal */
export function formatRupiah(nilai: number | string | null | undefined): string {
  const angka = Number(nilai ?? 0);
  if (!Number.isFinite(angka)) return "Rp 0";
  return "Rp " + new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(angka);
}

/** 1.250.000,50 */
export function formatAngka(nilai: number | string | null | undefined, desimal = 2): string {
  const angka = Number(nilai ?? 0);
  if (!Number.isFinite(angka)) return "0";
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: desimal,
    maximumFractionDigits: desimal,
  }).format(angka);
}
