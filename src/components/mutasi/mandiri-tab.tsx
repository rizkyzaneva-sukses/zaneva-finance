"use client";

import * as React from "react";
import {
  Upload,
  X,
  Download,
  Copy,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatAngka, formatRupiah } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { copyTsv } from "@/lib/clipboard";
import { usePasteImages } from "@/hooks/use-paste-images";
import type { MandiriMeta, MandiriTransaction } from "@/lib/types";

interface Verifikasi {
  cocok: boolean;
  selisih: number;
  totalDebit: number;
  totalKredit: number;
}

type SourceMode = "pdf" | "screenshot";

export function MandiriTab() {
  const [mode, setMode] = React.useState<SourceMode>("pdf");

  // Mode PDF
  const [file, setFile] = React.useState<File | null>(null);
  const [password, setPassword] = React.useState("02071993");
  const [showPassword, setShowPassword] = React.useState(false);
  const pdfInputRef = React.useRef<HTMLInputElement>(null);

  // Mode screenshot
  const [images, setImages] = React.useState<File[]>([]);
  const imgInputRef = React.useRef<HTMLInputElement>(null);

  const [rows, setRows] = React.useState<MandiriTransaction[]>([]);
  const [meta, setMeta] = React.useState<MandiriMeta | null>(null);
  const [verifikasi, setVerifikasi] = React.useState<Verifikasi | null>(null);
  const [processing, setProcessing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  function addImages(list: FileList | File[] | null) {
    if (!list) return;
    setImages((prev) => [...prev, ...Array.from(list)]);
  }

  usePasteImages((pasted) => {
    if (mode === "screenshot") addImages(pasted);
  });

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetHasil() {
    setRows([]);
    setMeta(null);
    setVerifikasi(null);
  }

  async function handleProsesPdf() {
    if (!file) {
      toast.error("Pilih file PDF e-Statement Mandiri dulu");
      return;
    }
    setProcessing(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("password", password);
      const res = await fetch("/api/parse/mandiri", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses PDF");
        return;
      }
      setRows(data.transactions);
      setMeta(data.meta);
      setVerifikasi(data.verifikasi);
      toast.success(`Berhasil parsing ${data.transactions.length} transaksi`);
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setProcessing(false);
    }
  }

  async function handleProsesScreenshot() {
    if (images.length === 0) {
      toast.error("Pilih minimal satu screenshot mutasi dulu");
      return;
    }
    setProcessing(true);
    try {
      const form = new FormData();
      images.forEach((f) => form.append("files", f));
      const res = await fetch("/api/parse/mandiri-ss", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses gambar");
        return;
      }
      setRows(data.transactions);
      setMeta(null);
      setVerifikasi(null);
      const tidakYakin = data.transactions.filter((r: MandiriTransaction) => r.yakin === false).length;
      toast.success(
        `Berhasil parsing ${data.transactions.length} transaksi` +
          (tidakYakin > 0 ? ` (${tidakYakin} perlu dicek manual)` : "")
      );
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setProcessing(false);
    }
  }

  async function handleCopy() {
    if (rows.length === 0) {
      toast.error("Belum ada data untuk disalin");
      return;
    }
    try {
      const header = ["TANGGAL", "TRANSAKSI", "DEBIT", "KREDIT", "SALDO"];
      const data = rows.map((r) => [
        r.tanggal,
        r.transaksi,
        r.debit || "",
        r.kredit || "",
        r.saldo ?? "",
      ]);
      await copyTsv([header, ...data]);
      toast.success("Data disalin, tinggal paste ke Excel/Sheets (Ctrl+V)");
    } catch {
      toast.error("Gagal menyalin ke clipboard");
    }
  }

  async function handleDownload() {
    if (rows.length === 0) {
      toast.error("Belum ada data untuk diexport");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/export/mandiri", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactions: rows }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Gagal membuat file Excel");
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, `Mutasi_Mandiri_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        role="tablist"
        aria-label="Sumber data Mandiri"
        className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
      >
        {([
          { key: "pdf", label: "PDF e-Statement" },
          { key: "screenshot", label: "Screenshot App" },
        ] as { key: SourceMode; label: string }[]).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mode === t.key}
            onClick={() => {
              setMode(t.key);
              resetHasil();
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === t.key
                ? "bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-50"
                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mode === "pdf" ? (
        <div className="rounded-xl border border-gray-200 bg-card p-4 sm:p-6 dark:border-zinc-700">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload e-Statement Mandiri (PDF)
          </label>
          <div
            onClick={() => pdfInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) setFile(f);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
          >
            <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {file ? file.name : "Klik atau drag & drop PDF ke sini"}
            </p>
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Password PDF
            </label>
            <div className="relative max-w-xs">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-900 outline-none placeholder:text-gray-500 focus:ring-2 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-50 dark:placeholder:text-gray-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={handleProsesPdf}
            disabled={processing || !file}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {processing ? "Memproses..." : "Proses"}
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-card p-4 sm:p-6 dark:border-zinc-700">
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Upload screenshot mutasi app Mandiri (bisa lebih dari satu)
          </label>
          <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
            Saldo berjalan tidak ditampilkan di layar app, jadi kolom SALDO akan kosong untuk
            data dari screenshot.
          </p>
          <div
            onClick={() => imgInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addImages(e.dataTransfer.files);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
          >
            <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Klik, drag & drop, atau paste (Ctrl+V) gambar ke sini
            </p>
            <input
              ref={imgInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addImages(e.target.files)}
            />
          </div>

          {images.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {images.map((f, i) => (
                <li
                  key={`${f.name}-${i}`}
                  className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-700"
                >
                  <span className="truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="ml-2 shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={handleProsesScreenshot}
            disabled={processing || images.length === 0}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {processing ? "Memproses..." : "Proses"}
          </button>
        </div>
      )}

      {meta && (
        <div className="rounded-xl border border-gray-200 bg-card p-4 text-sm sm:p-6 dark:border-zinc-700">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {meta.nomorRekening && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">No. Rekening: </span>
                <span className="text-gray-900 dark:text-gray-50">{meta.nomorRekening}</span>
              </div>
            )}
            {meta.nama && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Nama: </span>
                <span className="text-gray-900 dark:text-gray-50">{meta.nama}</span>
              </div>
            )}
            {meta.periode && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Periode: </span>
                <span className="text-gray-900 dark:text-gray-50">{meta.periode}</span>
              </div>
            )}
            {meta.saldoAwal !== undefined && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Saldo Awal: </span>
                <span className="text-gray-900 dark:text-gray-50">{formatRupiah(meta.saldoAwal)}</span>
              </div>
            )}
            {meta.saldoAkhir !== undefined && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">Saldo Akhir: </span>
                <span className="text-gray-900 dark:text-gray-50">{formatRupiah(meta.saldoAkhir)}</span>
              </div>
            )}
          </div>

          {verifikasi && (
            <div
              className={
                verifikasi.cocok
                  ? "mt-3 flex items-center gap-2 rounded-lg bg-green-100 px-3 py-2 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                  : "mt-3 flex items-center gap-2 rounded-lg bg-amber-100 px-3 py-2 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
              }
            >
              {verifikasi.cocok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              {verifikasi.cocok
                ? "Saldo awal, kredit, debit, dan saldo akhir sudah cocok."
                : `Saldo tidak cocok, selisih ${formatRupiah(verifikasi.selisih)}. Kemungkinan ada baris yang gagal terbaca.`}
            </div>
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-card p-4 sm:p-6 dark:border-zinc-700">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
              Preview ({rows.length} transaksi)
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-zinc-700 dark:text-gray-300 dark:hover:bg-zinc-700"
              >
                <Copy className="h-4 w-4" />
                Copy All
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-green-500 dark:hover:bg-green-400"
              >
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Tanggal</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Transaksi</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Debit</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Kredit</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo</th>
                  {mode === "screenshot" && <th className="px-2 py-2"></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-b border-gray-100 dark:border-zinc-800",
                      r.yakin === false && "bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                      {r.tanggal}
                      {r.yakin === false && (
                        <span
                          title="Tidak yakin terbaca dengan benar, cek ulang gambar aslinya"
                          className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{r.transaksi}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {r.debit ? formatAngka(r.debit) : ""}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {r.kredit ? formatAngka(r.kredit) : ""}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {r.saldo !== null ? formatAngka(r.saldo) : "-"}
                    </td>
                    {mode === "screenshot" && (
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => removeRow(i)}
                          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
