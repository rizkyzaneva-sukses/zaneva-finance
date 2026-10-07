"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  FileSpreadsheet,
  Info,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  INPUT_CLASS,
  Modal,
  PageHeader,
  Skeleton,
  TabButton,
  TabList,
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { downloadBlob } from "@/lib/download";
import { cn, formatRupiah } from "@/lib/utils";

// ───────────────────────── tipe ─────────────────────────

interface BarisGagal {
  baris: number;
  sku: string;
  brand?: string;
  nilai: number | string | null;
  alasan: string;
}

interface PratinjauSo {
  namaSheet: string;
  jumlahBaris: number;
  jumlahValid: number;
  gagal: BarisGagal[];
  tidakAdaDiFile: { sku: string; brand: string }[];
  tidakAdaTotal: number;
  hppNol: { sku: string; stok: number }[];
  hppNolTotal: number;
  perBrand: { brand: string; jumlahSku: number; stok: number; nilai: number | null }[];
  totalStok: number;
  totalNilai: number | null;
  blokir: string | null;
  konflik: { pesan: string; jenis: string; posisiPada: string } | null;
}

interface PerubahanContoh {
  sku: string;
  hpp: number;
  hppLama?: number;
  brandLama?: string;
  brandBaru?: string;
}

interface PratinjauMaster {
  namaSheet: string;
  jumlahBaris: number;
  baru: number;
  ubah: number;
  sama: number;
  gagal: BarisGagal[];
  brandBaru: { nama: string; kunci: string; jumlahSku: number }[];
  disamakan: { tertulis: string; jadi: string; jumlah: number }[];
  contohUbah: PerubahanContoh[];
  contohBaru: PerubahanContoh[];
}

interface SoRow {
  id: string;
  jenis: "AWAL" | "BULANAN";
  tanggalInput: string;
  posisiPada: string;
  jumlahSku: number;
  totalStok: number;
  totalNilai: number | null;
  statusAcc: "DISETUJUI" | "MENUNGGU";
  accOleh: string | null;
  diunggahOleh: string | null;
  perBrand: { brand: string; stok: number; nilai: number | null }[];
}

interface ProdukRow {
  id: string;
  sku: string;
  hpp: string;
  brand: { nama: string };
}

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function tglPendek(isoStr: string) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

function hariIniLokal() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}

/**
 * SO yang dihitung tanggal 1-5 adalah stok AKHIR bulan sebelumnya (tim biasanya
 * menghitung tanggal 1, atau tanggal 2 kalau tanggal 1 libur). Selain itu stoknya
 * dianggap berlaku pada tanggal input.
 */
function posisiOtomatis(jenis: string, tanggalInput: string) {
  if (jenis !== "BULANAN" || !tanggalInput) return tanggalInput;
  const [y, m, d] = tanggalInput.split("-").map(Number);
  if (d > 5) return tanggalInput;
  const akhir = new Date(Date.UTC(y, m - 1, 0));
  return akhir.toISOString().slice(0, 10);
}

async function unduhGagal(jenis: "so" | "produk", baris: BarisGagal[]) {
  const res = await fetch("/api/produk/gagal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jenis, baris }),
  });
  if (!res.ok) {
    toast.error("Gagal membuat file Excel");
    return;
  }
  downloadBlob(await res.blob(), `baris_gagal_${jenis}.xlsx`);
}

async function unduhTemplate() {
  const res = await fetch("/api/produk/template");
  if (!res.ok) {
    toast.error("Gagal mengunduh template");
    return;
  }
  downloadBlob(await res.blob(), "template_produk_so.xlsx");
}

// ───────────────────────── komponen kecil ─────────────────────────

function TabelGagal({ gagal, jenis }: { gagal: BarisGagal[]; jenis: "so" | "produk" }) {
  const tampil = gagal.slice(0, 100);
  return (
    <div className="rounded-lg border border-red-300 dark:border-red-800">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-300 bg-red-50 px-3 py-2 dark:border-red-800 dark:bg-red-900/30">
        <span className="flex items-center gap-2 text-sm font-semibold text-red-900 dark:text-red-200">
          <AlertTriangle className="h-4 w-4" />
          {gagal.length} baris gagal
        </span>
        <Button varian="sekunder" onClick={() => unduhGagal(jenis, gagal)} className="!py-1 text-xs">
          <Download className="h-3.5 w-3.5" />
          Download Excel baris gagal
        </Button>
      </div>
      <div className="max-h-56 overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr className="text-left text-gray-600 dark:text-gray-400">
              <th className="px-2 py-1.5 font-medium">Baris</th>
              <th className="px-2 py-1.5 font-medium">SKU</th>
              <th className="px-2 py-1.5 font-medium">{jenis === "so" ? "STOK SO" : "HPP"}</th>
              <th className="px-2 py-1.5 font-medium">Alasan</th>
            </tr>
          </thead>
          <tbody>
            {tampil.map((g, i) => (
              <tr key={`${g.baris}-${i}`} className="border-t border-gray-100 align-top dark:border-zinc-800">
                <td className="whitespace-nowrap px-2 py-1 text-gray-600 dark:text-gray-400">{g.baris}</td>
                <td className="px-2 py-1 text-gray-900 dark:text-gray-50">{g.sku || "(kosong)"}</td>
                <td className="whitespace-nowrap px-2 py-1 text-gray-900 dark:text-gray-50">{String(g.nilai ?? "")}</td>
                <td className="px-2 py-1 text-red-800 dark:text-red-300">{g.alasan}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {gagal.length > tampil.length && (
          <p className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400">
            dan {gagal.length - tampil.length} baris lain, lengkapnya ada di file Excel.
          </p>
        )}
      </div>
    </div>
  );
}

function Kotak({
  warna,
  children,
}: {
  warna: "amber" | "blue" | "red" | "green";
  children: React.ReactNode;
}) {
  const peta = {
    amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    blue: "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
    red: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200",
    green: "border-green-300 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200",
  };
  return <div className={cn("rounded-lg border px-3 py-2 text-sm", peta[warna])}>{children}</div>;
}

function Angka({ label, nilai, warna }: { label: string; nilai: React.ReactNode; warna?: string }) {
  return (
    <div className="rounded-lg border border-gray-200 px-3 py-2 dark:border-zinc-700">
      <div className="text-xs text-gray-600 dark:text-gray-400">{label}</div>
      <div className={cn("text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50", warna)}>{nilai}</div>
    </div>
  );
}

// ───────────────────────── tab Stok Opname ─────────────────────────

function TabSo({ role }: { role: string | null }) {
  const [daftar, setDaftar] = React.useState<SoRow[]>([]);
  const [lihatNilai, setLihatNilai] = React.useState(false);
  const [memuat, setMemuat] = React.useState(true);

  const [jenis, setJenis] = React.useState<"AWAL" | "BULANAN">("BULANAN");
  const [tanggalInput, setTanggalInput] = React.useState(hariIniLokal());
  const [posisiPada, setPosisiPada] = React.useState(posisiOtomatis("BULANAN", hariIniLokal()));
  const [posisiManual, setPosisiManual] = React.useState(false);
  const [catatan, setCatatan] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [mengecek, setMengecek] = React.useState(false);
  const [pratinjau, setPratinjau] = React.useState<PratinjauSo | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [timpa, setTimpa] = React.useState(false);
  const [jenisDicek, setJenisDicek] = React.useState<"AWAL" | "BULANAN">("BULANAN");

  const [detail, setDetail] = React.useState<SoRow | null>(null);
  const [hapusTarget, setHapusTarget] = React.useState<SoRow | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);

  const bolehAcc = role === "ADMIN" || role === "OWNER";

  const muat = React.useCallback(async () => {
    try {
      const res = await fetch("/api/so");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.so);
      setLihatNilai(data.lihatNilai);
      return data.so as SoRow[];
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat riwayat SO");
      return [];
    } finally {
      setMemuat(false);
    }
  }, []);

  // Jenis awal: kalau persediaan awal belum ada, itu yang harus diunggah dulu
  React.useEffect(() => {
    muat().then((so) => {
      if (!so.some((s) => s.jenis === "AWAL")) setJenis("AWAL");
    });
  }, [muat]);

  React.useEffect(() => {
    if (!posisiManual) setPosisiPada(posisiOtomatis(jenis, tanggalInput));
  }, [jenis, tanggalInput, posisiManual]);

  const adaAwal = daftar.some((s) => s.jenis === "AWAL");
  const terakhir = daftar[0];

  function kirim(mode: "cek" | "simpan", opsi: { simpanValidSaja?: boolean; timpa?: boolean } = {}) {
    const form = new FormData();
    form.append("file", file!);
    form.append("mode", mode);
    form.append("jenis", jenis);
    form.append("tanggalInput", tanggalInput);
    form.append("posisiPada", posisiPada);
    if (catatan.trim()) form.append("catatan", catatan.trim());
    if (opsi.simpanValidSaja) form.append("simpanValidSaja", "true");
    if (opsi.timpa) form.append("timpa", "true");
    return fetch("/api/so", { method: "POST", body: form });
  }

  async function cek() {
    if (!file) {
      toast.error("Pilih file Excel SO dulu");
      return;
    }
    setMengecek(true);
    try {
      const res = await kirim("cek");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membaca file");
      setPratinjau(data);
      setJenisDicek(jenis);
      setTimpa(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca file");
    } finally {
      setMengecek(false);
    }
  }

  async function simpan(validSaja: boolean) {
    setMenyimpan(true);
    try {
      const res = await kirim("simpan", { simpanValidSaja: validSaja, timpa });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.gagal) setPratinjau(data);
        throw new Error(data.error || "Gagal menyimpan");
      }
      toast.success(
        data.statusAcc === "MENUNGGU"
          ? "SO tersimpan, menunggu ACC Finance"
          : `SO tersimpan (${data.jumlahValid} SKU)`
      );
      setPratinjau(null);
      setFile(null);
      setCatatan("");
      const so = await muat();
      if (so.some((s) => s.jenis === "AWAL")) setJenis("BULANAN");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function acc(row: SoRow) {
    const res = await fetch(`/api/so/${row.id}`, { method: "PATCH" });
    if (res.ok) {
      toast.success("SO disetujui");
      muat();
    } else toast.error((await res.json().catch(() => ({}))).error || "Gagal ACC");
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/so/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("SO dihapus");
      setHapusTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setMenghapus(false);
    }
  }

  const p = pratinjau;
  const bisaSimpanPenuh = p && !p.blokir && p.gagal.length === 0 && p.jumlahValid > 0 && (!p.konflik || timpa);
  const bisaSimpanValid = p && !p.blokir && p.gagal.length > 0 && p.jumlahValid > 0 && (!p.konflik || timpa);

  return (
    <>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Unggah <strong>Persediaan Awal</strong> sekali (harta awal pembukuan), lalu <strong>SO Bulanan</strong> tiap
          awal bulan. Nilai persediaan = stok × HPP dari master saat SO diunggah, dan nilainya{" "}
          <strong>dikunci</strong> (HPP berubah bulan depan, Neraca bulan lalu tidak ikut berubah). Selisih antar SO
          jadi <strong>599 Selisih HPP</strong> di Laba Rugi.
        </span>
      </div>

      {lihatNilai && terakhir && terakhir.perBrand.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
            Nilai persediaan terakhir{" "}
            <span className="font-normal text-gray-600 dark:text-gray-400">
              (stok per {tglPendek(terakhir.posisiPada)}) · total {formatRupiah(terakhir.totalNilai)}
            </span>
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {terakhir.perBrand.map((b) => (
              <Angka key={b.brand} label={`${b.brand} · ${b.stok.toLocaleString("id-ID")} pcs`} nilai={formatRupiah(b.nilai)} />
            ))}
          </div>
        </Card>
      )}

      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Unggah stok opname</h2>
          <Button varian="sekunder" onClick={unduhTemplate} className="!py-1.5 text-xs">
            <FileSpreadsheet className="h-4 w-4" />
            Download template
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Jenis" required>
            <div
              role="radiogroup"
              aria-label="Jenis stok opname"
              className="flex w-full flex-wrap gap-1 rounded-lg border border-gray-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800"
            >
              {(
                [
                  ["AWAL", "Persediaan Awal"],
                  ["BULANAN", "SO Bulanan"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={jenis === v}
                  onClick={() => {
                    setJenis(v);
                    setPosisiManual(false);
                  }}
                  className={cn(
                    "min-h-11 flex-1 rounded-md px-2 text-sm font-medium whitespace-nowrap",
                    jenis === v
                      ? "bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-50"
                      : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700"
                  )}
                >
                  {l}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Tanggal input" required hint="Hari tim menginput SO (mis. tgl 1, atau tgl 2 kalau tgl 1 libur)">
            <input
              type="date"
              value={tanggalInput}
              max={hariIniLokal()}
              onChange={(e) => {
                setTanggalInput(e.target.value);
                setPosisiManual(false);
              }}
              className={INPUT_CLASS}
            />
          </Field>
          <Field
            label="Stok berlaku per tanggal"
            required
            hint={
              jenis === "BULANAN" && posisiPada !== tanggalInput
                ? "SO tgl 1–5 dihitung sebagai stok akhir bulan sebelumnya. Bisa diubah."
                : "Tanggal posisi stok ini dipakai di Neraca."
            }
          >
            <input
              type="date"
              value={posisiPada}
              onChange={(e) => {
                setPosisiPada(e.target.value);
                setPosisiManual(true);
              }}
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="Catatan" hint="Opsional">
            <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={INPUT_CLASS} placeholder="mis. SO gudang pusat" />
          </Field>
        </div>

        {!adaAwal && jenis === "BULANAN" && (
          <div className="mt-3">
            <Kotak warna="amber">Belum ada Persediaan Awal. Unggah Persediaan Awal dulu sebelum SO Bulanan.</Kotak>
          </div>
        )}

        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
          }}
          className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
        >
          <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
          {file ? (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-50">{file.name}</p>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Klik atau drag &amp; drop file Excel SO (kolom <strong>SKU</strong> dan <strong>STOK SO</strong>)
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) setFile(e.target.files[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div className="mt-4">
          <Button onClick={cek} loading={mengecek} disabled={!file}>
            {!mengecek && <CheckCircle2 className="h-4 w-4" />}
            {mengecek ? "Memeriksa..." : "Periksa file"}
          </Button>
          <span className="ml-3 text-xs text-gray-600 dark:text-gray-400">
            Belum disimpan; hasil pemeriksaan tampil dulu sebelum Anda memutuskan.
          </span>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">Riwayat SO</h2>
        {memuat ? (
          <Skeleton baris={4} />
        ) : daftar.length === 0 ? (
          <EmptyState pesan="Belum ada SO. Mulai dengan Persediaan Awal." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="px-2 py-2 font-medium">Jenis</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Stok per</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Diinput</th>
                  <th className="px-2 py-2 text-right font-medium">SKU</th>
                  <th className="px-2 py-2 text-right font-medium">Total stok</th>
                  {lihatNilai && <th className="px-2 py-2 text-right font-medium">Nilai persediaan</th>}
                  <th className="px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2 font-medium">Oleh</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((s) => (
                  <tr key={s.id} className="border-b border-gray-100 dark:border-zinc-800">
                    <td className="px-2 py-2">
                      <Badge warna={s.jenis === "AWAL" ? "biru" : "abu"}>
                        {s.jenis === "AWAL" ? "Persediaan Awal" : "SO Bulanan"}
                      </Badge>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{tglPendek(s.posisiPada)}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{tglPendek(s.tanggalInput)}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">{s.jumlahSku}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                      {s.totalStok.toLocaleString("id-ID")}
                    </td>
                    {lihatNilai && (
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                        {formatRupiah(s.totalNilai)}
                      </td>
                    )}
                    <td className="px-2 py-2">
                      {s.statusAcc === "MENUNGGU" ? (
                        <span className="inline-flex items-center gap-1">
                          <Badge warna="kuning">Menunggu ACC</Badge>
                          {bolehAcc && (
                            <button
                              type="button"
                              onClick={() => acc(s)}
                              className="text-xs font-medium text-blue-700 underline dark:text-blue-300"
                            >
                              Setujui
                            </button>
                          )}
                        </span>
                      ) : (
                        <Badge warna="hijau">Disetujui</Badge>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{s.diunggahOleh ?? "—"}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        title="Lihat rincian per SKU"
                        aria-label="Lihat rincian"
                        onClick={() => setDetail(s)}
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {bolehAcc && (
                        <button
                          type="button"
                          title="Hapus SO"
                          aria-label="Hapus SO"
                          onClick={() => setHapusTarget(s)}
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
        )}
      </Card>

      {/* ───── Pop up hasil pemeriksaan SO ───── */}
      <Modal
        buka={p !== null}
        lebar="lg"
        judul={`Hasil pemeriksaan ${jenisDicek === "AWAL" ? "Persediaan Awal" : "SO Bulanan"}`}
        deskripsi={p ? `Sheet "${p.namaSheet}" · ${p.jumlahBaris} baris · stok per ${tglPendek(posisiPada)}` : undefined}
        onTutup={() => setPratinjau(null)}
      >
        {p && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <Angka label="Baris valid" nilai={p.jumlahValid} warna="text-green-700 dark:text-green-400" />
              <Angka label="Baris gagal" nilai={p.gagal.length} warna={p.gagal.length ? "text-red-700 dark:text-red-400" : ""} />
              <Angka label="Total stok valid" nilai={p.totalStok.toLocaleString("id-ID")} />
            </div>

            {p.blokir && <Kotak warna="red">{p.blokir}</Kotak>}

            {p.konflik && (
              <Kotak warna="amber">
                <strong>{p.konflik.pesan}</strong> Menyimpan akan <strong>menimpa</strong> yang lama (tercatat di Log
                Aktivitas).
                <label className="mt-1.5 flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={timpa} onChange={(e) => setTimpa(e.target.checked)} />
                  Ya, timpa SO yang lama
                </label>
              </Kotak>
            )}

            {p.gagal.length > 0 && <TabelGagal gagal={p.gagal} jenis="so" />}
            {p.gagal.length > 0 && p.jumlahValid > 0 && (
              <Kotak warna="amber">
                Baris yang gagal <strong>tidak ikut tersimpan</strong>, jadi nilai persediaan akan lebih kecil dari
                kenyataan. Lebih aman: download Excel baris gagal, perbaiki, lalu unggah file lengkap.
              </Kotak>
            )}

            {p.tidakAdaTotal > 0 && (
              <Kotak warna="blue">
                <strong>{p.tidakAdaTotal} SKU di master tidak ada di file</strong> dan dianggap stok 0.
                <span className="block text-xs">
                  {p.tidakAdaDiFile.slice(0, 5).map((x) => x.sku).join(", ")}
                  {p.tidakAdaTotal > 5 && `, dan ${p.tidakAdaTotal - 5} lainnya`}
                </span>
              </Kotak>
            )}

            {p.hppNolTotal > 0 && (
              <Kotak warna="amber">
                <strong>{p.hppNolTotal} SKU berstok tapi HPP-nya masih 0</strong>, jadi nilainya terhitung Rp 0. Isi HPP
                di tab Master Produk, <strong>sebelum</strong> SO ini disimpan (HPP dikunci saat disimpan).
                <span className="block text-xs">
                  {p.hppNol.slice(0, 5).map((x) => x.sku).join(", ")}
                  {p.hppNolTotal > 5 && `, dan ${p.hppNolTotal - 5} lainnya`}
                </span>
              </Kotak>
            )}

            {p.perBrand.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-zinc-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 dark:text-gray-400">
                      <th className="px-3 py-1.5 font-medium">Brand</th>
                      <th className="px-3 py-1.5 text-right font-medium">SKU berstok</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total stok</th>
                      {p.totalNilai !== null && <th className="px-3 py-1.5 text-right font-medium">Nilai</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {p.perBrand.map((b) => (
                      <tr key={b.brand} className="border-t border-gray-100 dark:border-zinc-800">
                        <td className="px-3 py-1.5 text-gray-900 dark:text-gray-50">{b.brand}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">{b.jumlahSku}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">
                          {b.stok.toLocaleString("id-ID")}
                        </td>
                        {p.totalNilai !== null && (
                          <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">
                            {formatRupiah(b.nilai)}
                          </td>
                        )}
                      </tr>
                    ))}
                    {p.totalNilai !== null && (
                      <tr className="border-t-2 border-gray-300 font-semibold dark:border-zinc-600">
                        <td className="px-3 py-1.5 text-gray-900 dark:text-gray-50" colSpan={3}>
                          Total nilai persediaan
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">
                          {formatRupiah(p.totalNilai)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button varian="sekunder" onClick={() => setPratinjau(null)}>
                {p.gagal.length > 0 ? "Batal, saya perbaiki dulu" : "Batal"}
              </Button>
              {bisaSimpanValid && (
                <Button varian="bahaya" loading={menyimpan} onClick={() => simpan(true)}>
                  Simpan {p.jumlahValid} baris valid saja
                </Button>
              )}
              {bisaSimpanPenuh && (
                <Button varian="sukses" loading={menyimpan} onClick={() => simpan(false)}>
                  Simpan SO
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <DetailSo so={detail} onTutup={() => setDetail(null)} />

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus SO ini?"
        pesan={`SO stok per ${hapusTarget ? tglPendek(hapusTarget.posisiPada) : ""} dihapus dan nilai persediaan di Neraca berubah. Tercatat di Log Aktivitas.`}
        labelKonfirmasi="Hapus SO"
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}

function DetailSo({ so, onTutup }: { so: SoRow | null; onTutup: () => void }) {
  const [items, setItems] = React.useState<
    { sku: string; brand: string; stok: number; hpp: number | null; nilai: number | null }[] | null
  >(null);
  const [lihatNilai, setLihatNilai] = React.useState(false);
  const [cari, setCari] = React.useState("");

  React.useEffect(() => {
    if (!so) return;
    setItems(null);
    setCari("");
    (async () => {
      const res = await fetch(`/api/so/${so.id}`);
      const data = await res.json();
      if (res.ok) {
        setItems(data.items);
        setLihatNilai(data.lihatNilai);
      } else toast.error(data.error || "Gagal memuat rincian");
    })();
  }, [so]);

  const q = cari.trim().toLowerCase();
  const tampil = (items ?? []).filter((i) => !q || i.sku.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q));

  return (
    <Modal
      buka={so !== null}
      lebar="lg"
      judul={so ? `${so.jenis === "AWAL" ? "Persediaan Awal" : "SO Bulanan"} · stok per ${tglPendek(so.posisiPada)}` : ""}
      onTutup={onTutup}
    >
      <input
        value={cari}
        onChange={(e) => setCari(e.target.value)}
        placeholder="Cari SKU atau brand"
        className={cn(INPUT_CLASS, "mb-3")}
      />
      {items === null ? (
        <Skeleton baris={5} />
      ) : (
        <div className="max-h-96 overflow-auto rounded-lg border border-gray-200 dark:border-zinc-700">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="text-left text-gray-600 dark:text-gray-400">
                <th className="px-3 py-1.5 font-medium">SKU</th>
                <th className="px-3 py-1.5 font-medium">Brand</th>
                <th className="px-3 py-1.5 text-right font-medium">Stok</th>
                {lihatNilai && <th className="px-3 py-1.5 text-right font-medium">HPP (saat SO)</th>}
                {lihatNilai && <th className="px-3 py-1.5 text-right font-medium">Nilai</th>}
              </tr>
            </thead>
            <tbody>
              {tampil.slice(0, 300).map((i) => (
                <tr key={i.sku} className="border-t border-gray-100 dark:border-zinc-800">
                  <td className="px-3 py-1.5 text-gray-900 dark:text-gray-50">{i.sku}</td>
                  <td className="px-3 py-1.5 text-gray-900 dark:text-gray-50">{i.brand}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">{i.stok}</td>
                  {lihatNilai && (
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">{formatRupiah(i.hpp)}</td>
                  )}
                  {lihatNilai && (
                    <td className="px-3 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">{formatRupiah(i.nilai)}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
            {tampil.length} SKU{tampil.length > 300 && " (300 pertama ditampilkan, gunakan pencarian)"}
          </p>
        </div>
      )}
    </Modal>
  );
}

// ───────────────────────── tab Master Produk ─────────────────────────

function TabMaster() {
  const [produk, setProduk] = React.useState<ProdukRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalSemua, setTotalSemua] = React.useState(0);
  const [hppNol, setHppNol] = React.useState(0);
  const [halaman, setHalaman] = React.useState(1);
  const [cari, setCari] = React.useState("");
  const [brandId, setBrandId] = React.useState<string | null>(null);
  const [hanyaNol, setHanyaNol] = React.useState(false);
  const [brand, setBrand] = React.useState<{ id: string; nama: string; _count: { produk: number } }[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const perHalaman = 50;

  const [file, setFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [mengecek, setMengecek] = React.useState(false);
  const [pratinjau, setPratinjau] = React.useState<PratinjauMaster | null>(null);
  const [setujuBrand, setSetujuBrand] = React.useState(false);
  const [menerapkan, setMenerapkan] = React.useState(false);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const q = new URLSearchParams({ halaman: String(halaman), perHalaman: String(perHalaman) });
      if (cari.trim()) q.set("q", cari.trim());
      if (brandId) q.set("brandId", brandId);
      if (hanyaNol) q.set("hppNol", "1");
      const [res, rb] = await Promise.all([fetch(`/api/produk?${q}`), fetch("/api/brand")]);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProduk(data.produk);
      setTotal(data.total);
      setTotalSemua(data.totalSemua);
      setHppNol(data.hppNol);
      if (rb.ok) setBrand((await rb.json()).brand);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat produk");
    } finally {
      setMemuat(false);
    }
  }, [halaman, cari, brandId, hanyaNol]);

  React.useEffect(() => {
    const t = setTimeout(muat, cari ? 300 : 0);
    return () => clearTimeout(t);
  }, [muat, cari]);

  function kirim(mode: "cek" | "terapkan", f: File, setuju = false) {
    const form = new FormData();
    form.append("file", f);
    form.append("mode", mode);
    if (setuju) form.append("setujuBrandBaru", "true");
    return fetch("/api/produk/import", { method: "POST", body: form });
  }

  async function pilihFile(f: File | null) {
    if (!f) return;
    setFile(f);
    setMengecek(true);
    try {
      const res = await kirim("cek", f);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membaca file");
      setPratinjau(data);
      setSetujuBrand(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membaca file");
    } finally {
      setMengecek(false);
    }
  }

  async function terapkan() {
    if (!file) return;
    setMenerapkan(true);
    try {
      const res = await kirim("terapkan", file, setujuBrand);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      toast.success(`${data.baru} SKU baru, ${data.ubah} diubah`);
      setPratinjau(null);
      setFile(null);
      setHalaman(1);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenerapkan(false);
    }
  }

  const p = pratinjau;
  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const adaPerubahan = p ? p.baru + p.ubah > 0 : false;
  const butuhSetujuBrand = p ? p.brandBaru.length > 0 && !setujuBrand : false;

  return (
    <>
      <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Master produk berisi <strong>SKU, Brand, HPP</strong> semua brand sekaligus. Untuk mengubah HPP banyak SKU:{" "}
          <strong>download template</strong> (sudah berisi data sekarang), ubah kolom HPP di Excel, lalu unggah.
          Hanya baris yang berubah yang diproses, dan hasilnya ditampilkan dulu sebelum disimpan. SO yang sudah
          tersimpan tidak terpengaruh.
        </span>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button varian="sekunder" onClick={unduhTemplate}>
            <FileSpreadsheet className="h-4 w-4" />
            Download template (data sekarang)
          </Button>
          <Button onClick={() => inputRef.current?.click()} loading={mengecek}>
            {!mengecek && <Upload className="h-4 w-4" />}
            Unggah master / update HPP
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              pilihFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {totalSemua.toLocaleString("id-ID")} SKU
            {hppNol > 0 && (
              <>
                {" · "}
                <button
                  type="button"
                  className="font-medium text-amber-700 underline dark:text-amber-300"
                  onClick={() => {
                    setHanyaNol(!hanyaNol);
                    setHalaman(1);
                  }}
                >
                  {hppNol.toLocaleString("id-ID")} SKU HPP masih 0 {hanyaNol && "(filter aktif)"}
                </button>
              </>
            )}
          </span>
        </div>
      </Card>

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Cari SKU">
            <input
              value={cari}
              onChange={(e) => {
                setCari(e.target.value);
                setHalaman(1);
              }}
              placeholder="mis. Hoodie"
              className={INPUT_CLASS}
            />
          </Field>
          <SearchableSelect
            label="Brand"
            value={brandId}
            onChange={(v) => {
              setBrandId(v);
              setHalaman(1);
            }}
            options={brand.map((b) => ({ value: b.id, label: b.nama, hint: `${b._count.produk} SKU` }))}
            placeholder="Semua brand"
          />
        </div>
      </Card>

      <Card>
        {memuat ? (
          <Skeleton baris={6} />
        ) : produk.length === 0 ? (
          <EmptyState
            pesan={
              totalSemua === 0
                ? "Master produk masih kosong. Unggah file Excel (kolom SKU, Brand, HPP)."
                : "Tidak ada produk yang cocok dengan filter."
            }
          />
        ) : (
          <>
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              {total.toLocaleString("id-ID")} SKU · halaman {halaman} dari {totalHalaman}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="px-2 py-2 font-medium">SKU</th>
                    <th className="px-2 py-2 font-medium">Brand</th>
                    <th className="px-2 py-2 text-right font-medium">HPP</th>
                  </tr>
                </thead>
                <tbody>
                  {produk.map((x) => (
                    <tr key={x.id} className="border-b border-gray-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-50">{x.sku}</td>
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-50">{x.brand.nama}</td>
                      <td
                        className={cn(
                          "px-2 py-1.5 text-right tabular-nums",
                          Number(x.hpp) === 0 ? "text-amber-700 dark:text-amber-300" : "text-gray-900 dark:text-gray-50"
                        )}
                      >
                        {formatRupiah(x.hpp)}
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

      {/* ───── Pop up hasil pemeriksaan master ───── */}
      <Modal
        buka={p !== null}
        lebar="lg"
        judul="Hasil pemeriksaan master produk"
        deskripsi={p ? `Sheet "${p.namaSheet}" · ${p.jumlahBaris} baris` : undefined}
        onTutup={() => setPratinjau(null)}
      >
        {p && (
          <div className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <Angka label="SKU baru" nilai={p.baru} warna="text-green-700 dark:text-green-400" />
              <Angka label="Diubah (HPP/brand)" nilai={p.ubah} warna="text-blue-700 dark:text-blue-400" />
              <Angka label="Tidak berubah" nilai={p.sama} />
              <Angka label="Gagal" nilai={p.gagal.length} warna={p.gagal.length ? "text-red-700 dark:text-red-400" : ""} />
            </div>

            {p.brandBaru.length > 0 && (
              <Kotak warna="amber">
                <strong>Brand baru akan dibuat:</strong>{" "}
                {p.brandBaru.map((b) => `${b.nama} (${b.jumlahSku} SKU)`).join(", ")}
                <label className="mt-1.5 flex items-center gap-2 font-medium">
                  <input type="checkbox" checked={setujuBrand} onChange={(e) => setSetujuBrand(e.target.checked)} />
                  Ya, buat brand ini
                </label>
              </Kotak>
            )}

            {p.disamakan.length > 0 && (
              <Kotak warna="blue">
                <strong>Penulisan brand disamakan:</strong>{" "}
                {p.disamakan.map((d) => `"${d.tertulis}" → "${d.jadi}" (${d.jumlah} baris)`).join("; ")}
              </Kotak>
            )}

            {p.gagal.length > 0 && <TabelGagal gagal={p.gagal} jenis="produk" />}
            {p.gagal.length > 0 && adaPerubahan && (
              <Kotak warna="blue">
                Baris yang gagal dilewati, baris lainnya tetap bisa disimpan. Perbaiki baris gagal lalu unggah ulang
                kapan saja.
              </Kotak>
            )}

            {p.contohUbah.length > 0 && (
              <div className="rounded-lg border border-gray-200 dark:border-zinc-700">
                <div className="border-b border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-zinc-700 dark:text-gray-300">
                  Contoh perubahan ({Math.min(p.contohUbah.length, 30)} dari {p.ubah})
                </div>
                <div className="max-h-48 overflow-auto">
                  <table className="w-full text-xs">
                    <tbody>
                      {p.contohUbah.map((c) => (
                        <tr key={c.sku} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-3 py-1 text-gray-900 dark:text-gray-50">{c.sku}</td>
                          <td className="whitespace-nowrap px-3 py-1 text-right tabular-nums text-gray-900 dark:text-gray-50">
                            {formatRupiah(c.hppLama)} → <strong>{formatRupiah(c.hpp)}</strong>
                          </td>
                          <td className="px-3 py-1 text-gray-600 dark:text-gray-400">
                            {c.brandLama && `brand ${c.brandLama} → ${c.brandBaru}`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!adaPerubahan && p.gagal.length === 0 && <Kotak warna="green">Tidak ada perubahan: semua baris sama dengan data sekarang.</Kotak>}

            <div className="flex flex-wrap justify-end gap-2 pt-1">
              <Button varian="sekunder" onClick={() => setPratinjau(null)}>
                Batal
              </Button>
              <Button
                varian="sukses"
                loading={menerapkan}
                disabled={!adaPerubahan || butuhSetujuBrand}
                onClick={terapkan}
              >
                Terapkan {p.baru + p.ubah} perubahan
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

// ───────────────────────── halaman ─────────────────────────

export default function StokPage() {
  const [role, setRole] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<"so" | "master">("so");

  React.useEffect(() => {
    (async () => {
      const res = await fetch("/api/auth/me");
      if (res.ok) setRole((await res.json()).user.role);
    })();
  }, []);

  const bolehMaster = role === "ADMIN" || role === "OWNER";

  return (
    <>
      <PageHeader
        judul="Stok & HPP"
        deskripsi="Stok opname bulanan dan master produk (HPP). Dasar nilai persediaan di Neraca dan Selisih HPP di Laba Rugi."
      />

      <TabList label="Bagian Stok dan HPP" className="mb-4">
        {(
          [
            ["so", "Stok Opname"],
            ...(bolehMaster ? [["master", "Master Produk (HPP)"]] : []),
          ] as [typeof tab, string][]
        ).map(([k, l]) => (
          <TabButton key={k} aktif={tab === k} onClick={() => setTab(k)}>
            {l}
          </TabButton>
        ))}
      </TabList>

      {tab === "so" ? <TabSo role={role} /> : bolehMaster ? <TabMaster /> : null}
    </>
  );
}
