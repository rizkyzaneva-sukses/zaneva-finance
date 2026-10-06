"use client";

import * as React from "react";
import { Loader2, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const INPUT_CLASS =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-50 dark:placeholder:text-gray-400";

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="ml-0.5 text-red-600 dark:text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-card p-4 sm:p-6 dark:border-zinc-700",
        className
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  judul,
  deskripsi,
  aksi,
}: {
  judul: string;
  deskripsi?: string;
  aksi?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">{judul}</h1>
        {deskripsi && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{deskripsi}</p>}
      </div>
      {aksi && <div className="flex items-center gap-2">{aksi}</div>}
    </div>
  );
}

type Varian = "primer" | "sekunder" | "bahaya" | "sukses";

const VARIAN: Record<Varian, string> = {
  primer:
    "bg-blue-600 text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400",
  sekunder:
    "border border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700",
  bahaya: "bg-red-600 text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-400",
  sukses:
    "bg-green-600 text-white hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400",
};

export function Button({
  varian = "primer",
  loading,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { varian?: Varian; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        VARIAN[varian],
        className
      )}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function EmptyState({ pesan, aksi }: { pesan: string; aksi?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Inbox className="h-8 w-8 text-gray-400 dark:text-gray-500" />
      <p className="text-sm text-gray-600 dark:text-gray-400">{pesan}</p>
      {aksi}
    </div>
  );
}

export function Skeleton({ baris = 5 }: { baris?: number }) {
  return (
    <div className="space-y-2 py-2">
      {Array.from({ length: baris }).map((_, i) => (
        <div key={i} className="h-9 animate-pulse rounded bg-gray-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

export function Badge({
  warna = "abu",
  children,
}: {
  warna?: "abu" | "hijau" | "kuning" | "merah" | "biru";
  children: React.ReactNode;
}) {
  const peta = {
    abu: "bg-gray-100 text-gray-800 dark:bg-zinc-700 dark:text-gray-200",
    hijau: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    kuning: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    merah: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    biru: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  };
  return (
    <span className={cn("inline-flex rounded px-1.5 py-0.5 text-xs font-medium", peta[warna])}>
      {children}
    </span>
  );
}

/** Dialog konfirmasi — dipakai sebelum aksi yang tidak bisa dibatalkan. */
export function ConfirmDialog({
  buka,
  judul,
  pesan,
  labelKonfirmasi = "Hapus",
  onKonfirmasi,
  onBatal,
  loading,
}: {
  buka: boolean;
  judul: string;
  pesan: string;
  labelKonfirmasi?: string;
  onKonfirmasi: () => void;
  onBatal: () => void;
  loading?: boolean;
}) {
  if (!buka) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Batal" onClick={onBatal} className="absolute inset-0 bg-black/50" />
      <div className="relative w-full max-w-sm rounded-xl border border-gray-200 bg-card p-5 shadow-xl dark:border-zinc-700">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">{judul}</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{pesan}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button varian="sekunder" onClick={onBatal}>
            Batal
          </Button>
          <Button varian="bahaya" loading={loading} onClick={onKonfirmasi}>
            {labelKonfirmasi}
          </Button>
        </div>
      </div>
    </div>
  );
}
