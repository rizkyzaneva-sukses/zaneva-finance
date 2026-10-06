"use client";

import * as React from "react";
import { CheckCircle2, AlertTriangle, Plus, X, Scissors } from "lucide-react";
import { Button, INPUT_CLASS } from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { cn, formatAngka } from "@/lib/utils";

export interface RincianForm {
  kodeAkunId: string | null;
  /** Disimpan sebagai teks supaya ketikan user (mis. "1000000.5") tidak berubah-ubah */
  nominal: string;
  keterangan: string;
}

interface Props {
  total: number;
  arah: "masuk" | "keluar";
  keteranganAsli: string;
  opsiKode: SelectOption[];
  awal: RincianForm[];
  menyimpan?: boolean;
  /** Tampilkan tombol batalkan split (hanya relevan kalau sudah pernah di-split) */
  bolehBatalkan?: boolean;
  onSimpan: (rincian: RincianForm[]) => void;
  onBatalkanSplit?: () => void;
  onTutup: () => void;
}

const BARIS_KOSONG = (): RincianForm => ({ kodeAkunId: null, nominal: "", keterangan: "" });

/** Hitung dalam sen supaya 0,1 + 0,2 tidak jadi 0,30000000000000004 */
const keSen = (teks: string) => Math.round((Number(teks) || 0) * 100);

export function SplitEditor({
  total,
  arah,
  keteranganAsli,
  opsiKode,
  awal,
  menyimpan,
  bolehBatalkan,
  onSimpan,
  onBatalkanSplit,
  onTutup,
}: Props) {
  const [baris, setBaris] = React.useState<RincianForm[]>(
    awal.length >= 2 ? awal : [BARIS_KOSONG(), BARIS_KOSONG()]
  );

  const totalSen = Math.round(total * 100);
  const terpakaiSen = baris.reduce((s, r) => s + keSen(r.nominal), 0);
  const sisaSen = totalSen - terpakaiSen;

  const lengkap = baris.every((r) => r.kodeAkunId && keSen(r.nominal) > 0);
  const bisaSimpan = baris.length >= 2 && lengkap && sisaSen === 0;

  function ubah(i: number, patch: Partial<RincianForm>) {
    setBaris((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  function tambah() {
    // Baris baru langsung terisi sisa, jadi tinggal pilih kode di baris terakhir.
    const isi = sisaSen > 0 ? (sisaSen / 100).toString() : "";
    setBaris((prev) => [...prev, { ...BARIS_KOSONG(), nominal: isi }]);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto p-4 sm:items-center">
      <button
        type="button"
        aria-label="Tutup"
        onClick={onTutup}
        className="fixed inset-0 bg-black/50"
      />
      <div
        role="dialog"
        aria-label="Split transaksi"
        className="relative my-4 w-full max-w-3xl rounded-xl border border-gray-200 bg-card p-4 shadow-xl sm:p-5 dark:border-zinc-700"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-50">
              <Scissors className="h-4 w-4" />
              Split transaksi
            </h2>
            <p className="mt-1 break-words text-sm text-gray-600 dark:text-gray-400">
              {keteranganAsli}
            </p>
          </div>
          <button
            type="button"
            onClick={onTutup}
            aria-label="Tutup"
            className="shrink-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <span className="text-gray-700 dark:text-gray-300">
              Transaksi asli ({arah === "masuk" ? "uang masuk" : "uang keluar"}):{" "}
              <strong className="tabular-nums text-gray-900 dark:text-gray-50">
                {formatAngka(total)}
              </strong>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 font-medium",
                sisaSen === 0
                  ? "text-green-800 dark:text-green-300"
                  : "text-amber-800 dark:text-amber-300"
              )}
            >
              {sisaSen === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Total cocok
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  {sisaSen > 0 ? "Masih kurang" : "Kelebihan"}{" "}
                  <span className="tabular-nums">{formatAngka(Math.abs(sisaSen) / 100)}</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {baris.map((r, i) => (
            <div
              key={i}
              className="grid gap-2 rounded-lg border border-gray-200 p-3 sm:grid-cols-[1.4fr_1fr_1.2fr_auto] sm:items-end sm:border-0 sm:p-0 dark:border-zinc-700"
            >
              <SearchableSelect
                label={i === 0 ? "Kode akun" : undefined}
                value={r.kodeAkunId}
                onChange={(v) => ubah(i, { kodeAkunId: v })}
                options={opsiKode}
                placeholder="Pilih kode"
                searchPlaceholder="Cari kode atau nama..."
                emptyText="Kode tidak ditemukan"
              />
              <div>
                {i === 0 && (
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Nominal
                  </label>
                )}
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={r.nominal}
                  onChange={(e) => ubah(i, { nominal: e.target.value })}
                  placeholder="0"
                  aria-label={`Nominal rincian ${i + 1}`}
                  className={cn(INPUT_CLASS, "tabular-nums")}
                />
              </div>
              <div>
                {i === 0 && (
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Keterangan
                  </label>
                )}
                <input
                  value={r.keterangan}
                  onChange={(e) => ubah(i, { keterangan: e.target.value })}
                  placeholder="mis. untuk R, infaq, transport"
                  aria-label={`Keterangan rincian ${i + 1}`}
                  className={INPUT_CLASS}
                />
              </div>
              <button
                type="button"
                onClick={() => setBaris((prev) => prev.filter((_, j) => j !== i))}
                disabled={baris.length <= 2}
                aria-label={`Hapus rincian ${i + 1}`}
                title={baris.length <= 2 ? "Split butuh minimal 2 rincian" : "Hapus rincian"}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        <Button varian="sekunder" className="mt-3" onClick={tambah}>
          <Plus className="h-4 w-4" />
          Tambah rincian
        </Button>

        <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
          Rincian inilah yang dihitung di laporan. Transaksi asli dari bank tetap tersimpan dan
          muncul di kolom Catatan saat export.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            {bolehBatalkan && (
              <Button varian="bahaya" onClick={onBatalkanSplit} disabled={menyimpan}>
                Batalkan split
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button varian="sekunder" onClick={onTutup}>
              Batal
            </Button>
            <Button onClick={() => onSimpan(baris)} disabled={!bisaSimpan} loading={menyimpan}>
              Simpan split
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
