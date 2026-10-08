"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, AlertTriangle, Upload, Download, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  INPUT_CLASS,
  Modal,
  PageHeader,
  Skeleton,
  Badge,
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatRupiah, formatTanggal, labelBank, tanggalKeIso } from "@/lib/utils";

interface Rekening {
  id: string;
  nama: string;
  bank: string;
  nomorRekening: string | null;
  saldoAwal: string;
  tanggalSaldoAwal: string;
  aktif: boolean;
  urutan: number;
  brand: { id: string; nama: string } | null;
  _count: { transaksi: number };
}

const BANK_OPTIONS = [
  { value: "BCA", label: "BCA" },
  { value: "MANDIRI", label: "Mandiri" },
  { value: "BRI", label: "BRI" },
  { value: "BNI", label: "BNI" },
  { value: "PETTY_CASH", label: "Petty Cash (kas tunai)", hint: "Bukan bank; input manual oleh bendahara" },
  { value: "LAINNYA", label: "Lainnya" },
];

interface FormState {
  id: string | null;
  nama: string;
  bank: string | null;
  nomorRekening: string;
  saldoAwal: string;
  tanggalSaldoAwal: string;
  brandId: string | null;
}

interface PerubahanRekening {
  status: "baru" | "ubah";
  baris: number;
  nama: string;
  bank: string;
  brand: string | null;
  nomorRekening: string | null;
  saldoAwal: number;
  tanggalSaldoAwal: string;
  urutan: number;
  diubah: string[];
}

interface PratinjauRekening {
  namaSheet: string;
  jumlahBaris: number;
  baru: number;
  ubah: number;
  sama: number;
  gagal: { baris: number; nama: string; alasan: string }[];
  contohBaru: PerubahanRekening[];
  contohUbah: PerubahanRekening[];
}

const FORM_KOSONG: FormState = {
  id: null,
  nama: "",
  bank: null,
  nomorRekening: "",
  saldoAwal: "0",
  tanggalSaldoAwal: tanggalKeIso(new Date()),
  brandId: null,
};

export default function RekeningPage() {
  const [daftar, setDaftar] = React.useState<Rekening[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [hapusTarget, setHapusTarget] = React.useState<Rekening | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);
  const [daftarBrand, setDaftarBrand] = React.useState<{ id: string; nama: string }[]>([]);
  const [imporBuka, setImporBuka] = React.useState(false);
  const [imporPratinjau, setImporPratinjau] = React.useState<PratinjauRekening | null>(null);
  const [imporFile, setImporFile] = React.useState<File | null>(null);
  const [imporSibuk, setImporSibuk] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/brand")
      .then((r) => (r.ok ? r.json() : { brand: [] }))
      .then((d) => setDaftarBrand(d.brand))
      .catch(() => {});
  }, []);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/rekening");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.rekening);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat rekening");
    } finally {
      setMemuat(false);
    }
  }, []);

  React.useEffect(() => {
    muat();
  }, [muat]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.bank) {
      toast.error("Bank wajib dipilih");
      return;
    }
    setMenyimpan(true);
    try {
      const body = {
        nama: form.nama,
        bank: form.bank,
        nomorRekening: form.nomorRekening,
        saldoAwal: Number(form.saldoAwal) || 0,
        tanggalSaldoAwal: form.tanggalSaldoAwal,
        brandId: form.brandId,
      };
      const res = await fetch(form.id ? `/api/rekening/${form.id}` : "/api/rekening", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.saldoDihitungUlang
          ? "Rekening tersimpan, saldo berjalan dihitung ulang"
          : "Rekening tersimpan"
      );
      setForm(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function toggleAktif(r: Rekening) {
    try {
      const res = await fetch(`/api/rekening/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !r.aktif }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(r.aktif ? "Rekening dinonaktifkan" : "Rekening diaktifkan");
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/rekening/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("Rekening dihapus");
      setHapusTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setMenghapus(false);
    }
  }

  function bukaImpor() {
    setImporFile(null);
    setImporPratinjau(null);
    setImporBuka(true);
  }

  async function imporRekening(file: File, mode: "cek" | "terapkan") {
    setImporSibuk(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("mode", mode);
      const res = await fetch("/api/rekening/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (mode === "cek") {
        setImporPratinjau(data);
      } else {
        toast.success(
          `${data.baru} rekening baru, ${data.ubah} diubah` +
            (data.dihitungUlang ? `, ${data.dihitungUlang} saldo dihitung ulang` : "")
        );
        setImporBuka(false);
        setImporPratinjau(null);
        setImporFile(null);
        muat();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses file");
    } finally {
      setImporSibuk(false);
    }
  }

  return (
    <>
      <PageHeader
        judul="Rekening"
        deskripsi="Daftar rekening yang muncul di dropdown saat merekap. Saldo awal adalah titik nol pembukuan — kalau salah, seluruh saldo ikut salah."
        aksi={
          <div className="flex flex-wrap gap-2">
            <Button varian="sekunder" onClick={bukaImpor}>
              <Upload className="h-4 w-4" />
              Import Excel
            </Button>
            <Button onClick={() => setForm({ ...FORM_KOSONG })}>
              <Plus className="h-4 w-4" />
              Tambah Rekening
            </Button>
          </div>
        }
      />

      <Modal
        buka={imporBuka}
        judul="Import Rekening dari Excel"
        deskripsi={
          imporPratinjau
            ? undefined
            : "Unggah file .xlsx dengan kolom NAMA, BANK, BRAND (opsional), NO REKENING, SALDO AWAL, TANGGAL SALDO AWAL, URUTAN. Pakai tombol Download template kalau belum ada."
        }
        onTutup={() => {
          if (!imporSibuk) {
            setImporBuka(false);
            setImporPratinjau(null);
            setImporFile(null);
          }
        }}
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <a
              href="/api/rekening/template"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-zinc-600 dark:text-gray-200 dark:hover:bg-zinc-700"
            >
              <Download className="h-4 w-4" />
              Download template
            </a>
            {imporPratinjau?.gagal && imporPratinjau.gagal.length > 0 && (
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch("/api/rekening/template", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ baris: imporPratinjau.gagal }),
                  });
                  const blob = await res.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "rekening_gagal.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 px-3 py-1.5 text-sm font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900/30"
              >
                <Download className="h-4 w-4" />
                Unduh baris gagal ({imporPratinjau.gagal.length})
              </button>
            )}
          </div>

          {!imporPratinjau ? (
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 px-4 py-8 text-center hover:border-blue-400 hover:bg-blue-50/40 dark:border-zinc-600 dark:hover:border-blue-700 dark:hover:bg-blue-950/20">
              <FileSpreadsheet className="h-7 w-7 text-gray-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {imporFile ? imporFile.name : "Pilih file Excel (.xlsx)"}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Maks 5MB</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  setImporFile(f);
                  if (f) imporRekening(f, "cek");
                }}
              />
            </label>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="rounded-full bg-green-100 px-2.5 py-1 font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                  {imporPratinjau.baru} baru
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-1 font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                  {imporPratinjau.ubah} diubah
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700 dark:bg-zinc-700 dark:text-gray-200">
                  {imporPratinjau.sama} sama (dilewati)
                </span>
                {imporPratinjau.gagal.length > 0 && (
                  <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                    {imporPratinjau.gagal.length} gagal
                  </span>
                )}
              </div>

              {(imporPratinjau.contohBaru.length > 0 || imporPratinjau.contohUbah.length > 0) && (
                <div className="max-h-56 overflow-auto rounded-lg border border-gray-200 dark:border-zinc-700">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-zinc-800">
                      <tr className="text-left text-gray-600 dark:text-gray-300">
                        <th className="px-2 py-1.5 font-medium">Status</th>
                        <th className="px-2 py-1.5 font-medium">Nama</th>
                        <th className="px-2 py-1.5 font-medium">Bank</th>
                        <th className="px-2 py-1.5 font-medium">Brand</th>
                        <th className="px-2 py-1.5 text-right font-medium">Saldo awal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...imporPratinjau.contohUbah, ...imporPratinjau.contohBaru].map((r) => (
                        <tr key={`${r.status}-${r.baris}`} className="border-t border-gray-100 dark:border-zinc-800">
                          <td className="px-2 py-1">
                            {r.status === "baru" ? (
                              <span className="text-green-700 dark:text-green-300">baru</span>
                            ) : (
                              <span className="text-blue-700 dark:text-blue-300">
                                {r.diubah.length ? `ubah: ${r.diubah.join(", ")}` : "ubah"}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1 text-gray-900 dark:text-gray-50">{r.nama}</td>
                          <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{r.bank}</td>
                          <td className="px-2 py-1 text-gray-600 dark:text-gray-400">{r.brand ?? "—"}</td>
                          <td className="px-2 py-1 text-right tabular-nums text-gray-900 dark:text-gray-50">
                            {r.saldoAwal.toLocaleString("id-ID")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {imporPratinjau.gagal.length > 0 && (
                <ul className="max-h-32 space-y-1 overflow-auto text-xs text-red-700 dark:text-red-300">
                  {imporPratinjau.gagal.slice(0, 50).map((g) => (
                    <li key={g.baris}>
                      Baris {g.baris}: {g.nama || "(tanpa nama)"} — {g.alasan}
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex justify-end gap-2">
                <Button
                  varian="sekunder"
                  onClick={() => {
                    setImporPratinjau(null);
                    setImporFile(null);
                  }}
                >
                  Ganti file
                </Button>
                <Button
                  loading={imporSibuk}
                  disabled={imporPratinjau.baru + imporPratinjau.ubah === 0}
                  onClick={() => imporFile && imporRekening(imporFile, "terapkan")}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Terapkan {imporPratinjau.baru + imporPratinjau.ubah} perubahan
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        buka={form !== null}
        judul={form?.id ? `Ubah ${form.nama}` : "Rekening Baru"}
        onTutup={() => setForm(null)}
      >
        {form && (
          <form onSubmit={simpan} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama rekening" required hint='Bebas, contoh: "BCA CV 1"'>
              <input
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="BCA CV 1"
                className={INPUT_CLASS}
              />
            </Field>

            <SearchableSelect
              label="Bank"
              required
              value={form.bank}
              onChange={(v) => setForm({ ...form, bank: v })}
              options={BANK_OPTIONS}
              placeholder="Pilih bank"
            />

            <SearchableSelect
              label="Brand"
              value={form.brandId}
              onChange={(v) => setForm({ ...form, brandId: v })}
              options={daftarBrand.map((b) => ({ value: b.id, label: b.nama }))}
              placeholder="Tanpa brand"
              emptyText="Belum ada brand. Brand dibuat saat unggah master produk di Stok & HPP."
            />
            <p className="-mt-2 text-xs text-gray-600 dark:text-gray-400">
              Laporan per brand memuat rekening milik brand itu. Rekening tanpa brand hanya muncul di laporan Semua brand.
            </p>

            <Field label="Nomor rekening">
              <input
                value={form.nomorRekening}
                onChange={(e) => setForm({ ...form, nomorRekening: e.target.value })}
                placeholder="Opsional"
                className={INPUT_CLASS}
              />
            </Field>

            <Field label="Tanggal saldo awal" required>
              <input
                type="date"
                required
                value={form.tanggalSaldoAwal}
                onChange={(e) => setForm({ ...form, tanggalSaldoAwal: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="Saldo awal"
              required
              hint="Saldo rekening pada tanggal di atas, sebelum transaksi apa pun dicatat"
            >
              <input
                type="number"
                step="0.01"
                required
                value={form.saldoAwal}
                onChange={(e) => setForm({ ...form, saldoAwal: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" varian="sekunder" onClick={() => setForm(null)}>
                Batal
              </Button>
              <Button type="submit" loading={menyimpan}>
                Simpan
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Card>
        {memuat ? (
          <Skeleton />
        ) : daftar.length === 0 ? (
          <EmptyState
            pesan="Belum ada rekening. Tambahkan dulu sebelum bisa merekap mutasi."
            aksi={
              <Button onClick={() => setForm({ ...FORM_KOSONG })}>
                <Plus className="h-4 w-4" />
                Tambah Rekening
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Nama</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Bank</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Brand</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">No. Rekening</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo Awal</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Per Tanggal</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Transaksi</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((r) => (
                  <tr key={r.id} className="border-b border-gray-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-gray-900 dark:text-gray-50">
                      {r.nama}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                      {r.bank === "PETTY_CASH" ? <Badge warna="kuning">Petty Cash</Badge> : labelBank(r.bank)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                      {r.brand?.nama ?? <span className="text-gray-500 dark:text-gray-400">—</span>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-400">
                      {r.nomorRekening || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {formatRupiah(Number(r.saldoAwal))}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                      {formatTanggal(r.tanggalSaldoAwal)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                      {r._count.transaksi}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {r.aktif ? <Badge warna="hijau">Aktif</Badge> : <Badge>Nonaktif</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Ubah"
                          aria-label={`Ubah ${r.nama}`}
                          onClick={() =>
                            setForm({
                              id: r.id,
                              nama: r.nama,
                              bank: r.bank,
                              nomorRekening: r.nomorRekening ?? "",
                              saldoAwal: String(r.saldoAwal),
                              tanggalSaldoAwal: tanggalKeIso(r.tanggalSaldoAwal),
                              brandId: r.brand?.id ?? null,
                            })
                          }
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAktif(r)}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                        >
                          {r.aktif ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          title={
                            r._count.transaksi > 0
                              ? "Punya transaksi — nonaktifkan saja"
                              : "Hapus"
                          }
                          aria-label={`Hapus ${r.nama}`}
                          disabled={r._count.transaksi > 0}
                          onClick={() => setHapusTarget(r)}
                          className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {daftar.some((r) => r._count.transaksi > 0) && (
        <p className="mt-3 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Rekening yang sudah punya transaksi tidak bisa dihapus — nonaktifkan saja supaya riwayatnya tetap utuh.
        </p>
      )}

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus rekening?"
        pesan={`Rekening "${hapusTarget?.nama}" akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.`}
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}
