"use client";

import * as React from "react";
import { Download, FileText, ImageIcon, Info, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  INPUT_CLASS,
  PageHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { labelBank } from "@/lib/utils";

interface Dokumen {
  id: string;
  namaFile: string;
  tipe: string;
  ukuran: number;
  periode: string | null;
  catatan: string | null;
  diunggahPada: string;
  kedaluwarsaPada: string;
  fileDihapusPada: string | null;
  rekening: { nama: string };
  diunggahOleh: { nama: string } | null;
}

const OPSI_STATUS = [
  { value: "ada", label: "File masih tersimpan" },
  { value: "dihapus", label: "File sudah dihapus otomatis" },
];

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

const ukuranTeks = (b: number) =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;

const waktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

function periodeTeks(p: string | null) {
  if (!p) return "—";
  const [y, m] = p.split("-");
  return `${NAMA_BULAN[Number(m) - 1]} ${y}`;
}

/** Sisa masa simpan, ditulis dengan satuan yang paling terbaca. */
function SisaWaktu({ d }: { d: Dokumen }) {
  if (d.fileDihapusPada) {
    return (
      <span title={`Dihapus ${waktu(d.fileDihapusPada)}`}>
        <Badge>File sudah dihapus</Badge>
      </span>
    );
  }
  const ms = new Date(d.kedaluwarsaPada).getTime() - Date.now();
  if (ms <= 0) return <Badge warna="kuning">Segera dihapus</Badge>;
  const jam = Math.ceil(ms / 3_600_000);
  return (
    <Badge warna={jam <= 24 ? "kuning" : "biru"}>
      {jam >= 48 ? `${Math.ceil(jam / 24)} hari lagi` : `${jam} jam lagi`}
    </Badge>
  );
}

export default function DokumenPage() {
  const [rekening, setRekening] = React.useState<SelectOption[]>([]);
  const [role, setRole] = React.useState<string | null>(null);
  const [retensi, setRetensi] = React.useState(3);

  const [rekeningUnggah, setRekeningUnggah] = React.useState<string | null>(null);
  const [periodeUnggah, setPeriodeUnggah] = React.useState("");
  const [catatanUnggah, setCatatanUnggah] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [mengunggah, setMengunggah] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [daftar, setDaftar] = React.useState<Dokumen[]>([]);
  const [total, setTotal] = React.useState(0);
  const [halaman, setHalaman] = React.useState(1);
  const [memuat, setMemuat] = React.useState(true);
  const [filterRekening, setFilterRekening] = React.useState<string | null>(null);
  const [filterStatus, setFilterStatus] = React.useState<string | null>(null);
  const [filterPeriode, setFilterPeriode] = React.useState("");

  const [hapusTarget, setHapusTarget] = React.useState<Dokumen | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);

  const bolehHapus = role === "ADMIN" || role === "OWNER";
  const perHalaman = 30;

  React.useEffect(() => {
    (async () => {
      const [r1, r2] = await Promise.all([fetch("/api/rekening"), fetch("/api/auth/me")]);
      if (r1.ok) {
        const d = await r1.json();
        setRekening(
          d.rekening
            .filter((r: { aktif: boolean }) => r.aktif)
            .map((r: { id: string; nama: string; bank: string }) => ({
              value: r.id,
              label: r.nama,
              hint: labelBank(r.bank),
            }))
        );
      }
      if (r2.ok) setRole((await r2.json()).user.role);
    })();
  }, []);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const q = new URLSearchParams({ halaman: String(halaman), perHalaman: String(perHalaman) });
      if (filterRekening) q.set("rekeningId", filterRekening);
      if (filterStatus) q.set("status", filterStatus);
      if (filterPeriode) q.set("periode", filterPeriode);
      const res = await fetch(`/api/dokumen?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.dokumen);
      setTotal(data.total);
      setRetensi(data.retensiHari);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat dokumen");
    } finally {
      setMemuat(false);
    }
  }, [halaman, filterRekening, filterStatus, filterPeriode]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  function tambahFile(list: FileList | File[] | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function unggah() {
    if (!rekeningUnggah) {
      toast.error("Pilih rekening dulu supaya dokumennya tidak tercecer");
      return;
    }
    if (files.length === 0) {
      toast.error("Pilih minimal satu file");
      return;
    }
    setMengunggah(true);
    try {
      const form = new FormData();
      form.append("rekeningId", rekeningUnggah);
      if (periodeUnggah) form.append("periode", periodeUnggah);
      if (catatanUnggah.trim()) form.append("catatan", catatanUnggah.trim());
      files.forEach((f) => form.append("files", f));
      const res = await fetch("/api/dokumen", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mengunggah");
      toast.success(`${data.diunggah} dokumen tersimpan`);
      setFiles([]);
      setCatatanUnggah("");
      setHalaman(1);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengunggah");
    } finally {
      setMengunggah(false);
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/dokumen/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("File dihapus, catatannya tetap tersimpan");
      setHapusTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setMenghapus(false);
    }
  }

  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const totalUkuranDipilih = files.reduce((s, f) => s + f.size, 0);

  return (
    <>
      <PageHeader
        judul="Dokumen Mutasi"
        deskripsi="Arsip screenshot dan PDF mutasi bank, dikelompokkan per rekening supaya dokumentasinya rapi."
      />

      <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          File dihapus otomatis <strong>{retensi} hari</strong> setelah diunggah, karena mutasi bulanan bisa
          diunduh ulang dari bank. <strong>Catatannya tetap tersimpan</strong> (dokumen apa, rekening mana, siapa
          yang mengunggah, kapan), jadi riwayatnya tidak hilang walau filenya sudah tidak ada.
        </span>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Unggah dokumen</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <SearchableSelect
            label="Rekening"
            required
            value={rekeningUnggah}
            onChange={setRekeningUnggah}
            options={rekening}
            placeholder="Pilih rekening dulu"
            emptyText="Belum ada rekening"
          />
          <Field label="Periode mutasi" hint="Opsional, bulan yang dicakup dokumen">
            <input
              type="month"
              value={periodeUnggah}
              onChange={(e) => setPeriodeUnggah(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Catatan" hint="Opsional">
            <input
              value={catatanUnggah}
              onChange={(e) => setCatatanUnggah(e.target.value)}
              placeholder="mis. e-statement lengkap"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            tambahFile(e.dataTransfer.files);
          }}
          className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
        >
          <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Klik atau drag &amp; drop PDF dan gambar mutasi</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            PDF, PNG, JPG, WEBP. Maks 10 file sekali unggah, 15MB per file.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            multiple
            className="hidden"
            onChange={(e) => {
              tambahFile(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-700"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {f.type === "application/pdf" ? (
                    <FileText className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <ImageIcon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                  )}
                  <span className="truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                  <span className="shrink-0 text-xs text-gray-600 dark:text-gray-400">{ukuranTeks(f.size)}</span>
                </span>
                <button
                  type="button"
                  aria-label={`Hapus ${f.name} dari daftar`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="ml-2 shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={unggah} loading={mengunggah} disabled={files.length === 0}>
            {!mengunggah && <Upload className="h-4 w-4" />}
            {mengunggah ? "Mengunggah..." : `Unggah${files.length > 0 ? ` ${files.length} file` : ""}`}
          </Button>
          {files.length > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-400">Total {ukuranTeks(totalUkuranDipilih)}</span>
          )}
          {!rekeningUnggah && files.length > 0 && (
            <span className="text-xs text-gray-600 dark:text-gray-400">Pilih rekening dulu sebelum mengunggah.</span>
          )}
        </div>
      </Card>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SearchableSelect
            label="Rekening"
            value={filterRekening}
            onChange={(v) => {
              setFilterRekening(v);
              setHalaman(1);
            }}
            options={rekening}
            placeholder="Semua rekening"
          />
          <SearchableSelect
            label="Status file"
            value={filterStatus}
            onChange={(v) => {
              setFilterStatus(v);
              setHalaman(1);
            }}
            options={OPSI_STATUS}
            placeholder="Semua"
          />
          <Field label="Periode">
            <input
              type="month"
              value={filterPeriode}
              onChange={(e) => {
                setFilterPeriode(e.target.value);
                setHalaman(1);
              }}
              className={INPUT_CLASS}
            />
          </Field>
        </div>
      </Card>

      <Card>
        {memuat ? (
          <Skeleton baris={6} />
        ) : daftar.length === 0 ? (
          <EmptyState pesan="Belum ada dokumen yang cocok dengan filter ini." />
        ) : (
          <>
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              {total} dokumen · halaman {halaman} dari {totalHalaman}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="min-w-48 px-2 py-2 font-medium">File</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Rekening</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Periode</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Diunggah</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Masa simpan file</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((d) => (
                    <tr key={d.id} className="border-b border-gray-100 align-top dark:border-zinc-800">
                      <td className="px-2 py-2 text-gray-900 dark:text-gray-50">
                        <div className="flex items-start gap-2">
                          {d.tipe === "application/pdf" ? (
                            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                          ) : (
                            <ImageIcon className="mt-0.5 h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                          )}
                          <div className="min-w-0">
                            <div className="break-words">{d.namaFile}</div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {ukuranTeks(d.ukuran)}
                              {d.catatan && ` · ${d.catatan}`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{d.rekening.nama}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                        {periodeTeks(d.periode)}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                        {waktu(d.diunggahPada)}
                        <div className="text-xs text-gray-600 dark:text-gray-400">{d.diunggahOleh?.nama ?? "—"}</div>
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <SisaWaktu d={d} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {!d.fileDihapusPada && (
                          <a
                            href={`/api/dokumen/${d.id}`}
                            title="Unduh"
                            aria-label={`Unduh ${d.namaFile}`}
                            className="inline-flex rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                        {bolehHapus && !d.fileDihapusPada && (
                          <button
                            type="button"
                            title="Hapus file sekarang"
                            aria-label={`Hapus file ${d.namaFile}`}
                            onClick={() => setHapusTarget(d)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalHalaman > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <Button varian="sekunder" disabled={halaman <= 1} onClick={() => setHalaman((h) => h - 1)}>
                  Sebelumnya
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {halaman} / {totalHalaman}
                </span>
                <Button varian="sekunder" disabled={halaman >= totalHalaman} onClick={() => setHalaman((h) => h + 1)}>
                  Berikutnya
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus file sekarang?"
        pesan={`File "${hapusTarget?.namaFile}" dihapus dari penyimpanan dan tidak bisa dikembalikan. Catatannya tetap tersimpan, dan penghapusan ini tercatat di Log Aktivitas.`}
        labelKonfirmasi="Hapus file"
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}
