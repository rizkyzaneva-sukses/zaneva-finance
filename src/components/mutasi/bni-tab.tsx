"use client";

import * as React from "react";
import { Upload, X, Download, Copy, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { cn, formatAngka } from "@/lib/utils";
import { downloadBlob } from "@/lib/download";
import { copyTsv } from "@/lib/clipboard";
import { usePasteImages } from "@/hooks/use-paste-images";
import type { BniTransaction } from "@/lib/types";

export function BniTab() {
  const [files, setFiles] = React.useState<File[]>([]);
  const [rows, setRows] = React.useState<BniTransaction[]>([]);
  const [processing, setProcessing] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  usePasteImages(addFiles);

  function removeFile(idx: number) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleProses() {
    if (files.length === 0) {
      toast.error("Pilih minimal satu gambar screenshot mutasi dulu");
      return;
    }
    setProcessing(true);
    try {
      const form = new FormData();
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/parse/bni", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Gagal memproses gambar");
        return;
      }
      setRows(data.transactions);
      const tidakYakin = data.transactions.filter((r: BniTransaction) => !r.yakin).length;
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
      const header = ["TANGGAL", "URAIAN TRANSAKSI", "", "TYPE", "JUMLAH PEMBAYARAN", "SALDO"];
      const data = rows.map((r) => [r.tanggal, r.uraian, "", r.type, r.jumlah, r.saldo]);
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
      const res = await fetch("/api/export/bni", {
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
      downloadBlob(blob, `Mutasi_BNI_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-card p-4 sm:p-6 dark:border-zinc-700">
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
          Upload screenshot mutasi BNI (bisa lebih dari satu)
        </label>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            addFiles(e.dataTransfer.files);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
        >
          <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Klik, drag & drop, atau paste (Ctrl+V) gambar ke sini
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => addFiles(e.target.files)}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                <span className="truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
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
          onClick={handleProses}
          disabled={processing || files.length === 0}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {processing && <Loader2 className="h-4 w-4 animate-spin" />}
          {processing ? "Memproses..." : "Proses"}
        </button>
      </div>

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
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Uraian Transaksi</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Type</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Jumlah</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={cn(
                      "border-b border-gray-100 dark:border-zinc-800",
                      !r.yakin && "bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                      {r.tanggal}
                      {!r.yakin && (
                        <span
                          title="Tidak yakin terbaca dengan benar, cek ulang gambar aslinya"
                          className="ml-1 inline-flex items-center text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{r.uraian}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{r.type}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {formatAngka(r.jumlah)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {formatAngka(r.saldo)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </td>
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
