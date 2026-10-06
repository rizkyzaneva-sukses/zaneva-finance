"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, Search, Lock } from "lucide-react";
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
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface KodeAkun {
  id: string;
  kode: string;
  nama: string;
  kelompok: string;
  laporan: string | null;
  aktivitasKas: string | null;
  aktif: boolean;
  sistem: boolean;
  _count: { transaksi: number; rincian: number };
}

const OPSI_LAPORAN = [
  { value: "NERACA", label: "Neraca" },
  { value: "LABA_RUGI", label: "Laba Rugi" },
  { value: "TIDAK_ADA", label: "Tidak masuk laporan" },
];

const OPSI_FILTER_LAPORAN = [...OPSI_LAPORAN, { value: "BELUM", label: "Belum diatur" }];

const OPSI_AKTIVITAS = [
  { value: "OPERASI", label: "Operasi" },
  { value: "INVESTASI", label: "Investasi" },
  { value: "PENDANAAN", label: "Pendanaan" },
  { value: "PINDAH_DANA", label: "Pindah dana (bukan arus kas usaha)" },
];

function BadgeAktivitas({ aktivitas }: { aktivitas: string | null }) {
  const label = OPSI_AKTIVITAS.find((o) => o.value === aktivitas)?.label;
  if (!aktivitas || !label) return <Badge warna="kuning">Belum diatur</Badge>;
  if (aktivitas === "PINDAH_DANA") return <Badge>Pindah dana</Badge>;
  return <Badge warna="biru">{label}</Badge>;
}

function BadgeLaporan({ laporan }: { laporan: string | null }) {
  if (laporan === "NERACA") return <Badge warna="biru">Neraca</Badge>;
  if (laporan === "LABA_RUGI") return <Badge warna="hijau">Laba Rugi</Badge>;
  if (laporan === "TIDAK_ADA") return <Badge>Tidak masuk laporan</Badge>;
  return <Badge warna="kuning">Belum diatur</Badge>;
}

const KELOMPOK = [
  "HARTA",
  "UTANG",
  "MODAL",
  "PENDAPATAN",
  "PEMBELIAN",
  "BEBAN",
  "PINJAMAN",
  "ALOKASI",
  "LAINNYA",
];

const OPSI_KELOMPOK = KELOMPOK.map((k) => ({ value: k, label: k }));

interface FormState {
  id: string | null;
  kode: string;
  nama: string;
  kelompok: string | null;
  laporan: string | null;
  aktivitasKas: string | null;
}

const FORM_KOSONG: FormState = {
  id: null,
  kode: "",
  nama: "",
  kelompok: null,
  laporan: null,
  aktivitasKas: null,
};

export default function KodeAkunPage() {
  const [daftar, setDaftar] = React.useState<KodeAkun[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [cari, setCari] = React.useState("");
  const [filterKelompok, setFilterKelompok] = React.useState<string | null>(null);
  const [filterLaporan, setFilterLaporan] = React.useState<string | null>(null);
  const [hapusTarget, setHapusTarget] = React.useState<KodeAkun | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/kode-akun");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.kodeAkun);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat kode akun");
    } finally {
      setMemuat(false);
    }
  }, []);

  React.useEffect(() => {
    muat();
  }, [muat]);

  const tersaring = daftar.filter((k) => {
    const cocokCari =
      !cari ||
      k.kode.toLowerCase().includes(cari.toLowerCase()) ||
      k.nama.toLowerCase().includes(cari.toLowerCase());
    const cocokKelompok = !filterKelompok || k.kelompok === filterKelompok;
    const cocokLaporan =
      !filterLaporan ||
      (filterLaporan === "BELUM" ? k.laporan === null : k.laporan === filterLaporan);
    return cocokCari && cocokKelompok && cocokLaporan;
  });

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.kelompok) {
      toast.error("Kelompok wajib dipilih");
      return;
    }
    setMenyimpan(true);
    try {
      const res = await fetch(form.id ? `/api/kode-akun/${form.id}` : "/api/kode-akun", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kode: form.kode,
          nama: form.nama,
          kelompok: form.kelompok,
          laporan: form.laporan,
          aktivitasKas: form.aktivitasKas,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Kode akun tersimpan");
      setForm(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function toggleAktif(k: KodeAkun) {
    try {
      const res = await fetch(`/api/kode-akun/${k.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !k.aktif }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/kode-akun/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("Kode akun dihapus");
      setHapusTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setMenghapus(false);
    }
  }

  return (
    <>
      <PageHeader
        judul="Kode Akun"
        deskripsi="Chart of accounts yang dipakai AI untuk menyarankan kode dan tim untuk mengoreksinya."
        aksi={
          <Button onClick={() => setForm({ ...FORM_KOSONG })}>
            <Plus className="h-4 w-4" />
            Tambah Kode
          </Button>
        }
      />

      <Modal
        buka={form !== null}
        judul={form?.id ? `Ubah kode ${form.kode}` : "Kode Akun Baru"}
        deskripsi={form?.id ? form.nama : undefined}
        lebar="lg"
        onTutup={() => setForm(null)}
      >
        {form && (
          <form onSubmit={simpan} className="grid gap-4 sm:grid-cols-2">
            <Field label="Kode" required hint="Contoh: 402, 52001">
              <input
                required
                value={form.kode}
                onChange={(e) => setForm({ ...form, kode: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Nama" required>
              <input
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <SearchableSelect
              label="Kelompok"
              required
              value={form.kelompok}
              onChange={(v) => setForm({ ...form, kelompok: v })}
              options={OPSI_KELOMPOK}
              placeholder="Pilih kelompok"
            />
            <SearchableSelect
              label="Masuk laporan"
              value={form.laporan}
              onChange={(v) => setForm({ ...form, laporan: v })}
              options={OPSI_LAPORAN}
              placeholder="Belum diatur"
            />
            <SearchableSelect
              label="Aktivitas arus kas"
              value={form.aktivitasKas}
              onChange={(v) => setForm({ ...form, aktivitasKas: v })}
              options={OPSI_AKTIVITAS}
              placeholder="Belum diatur"
            />
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

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Cari
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Kode atau nama"
                className={`${INPUT_CLASS} pl-8`}
              />
            </div>
          </div>
          <div className="w-52">
            <SearchableSelect
              label="Kelompok"
              value={filterKelompok}
              onChange={setFilterKelompok}
              options={OPSI_KELOMPOK}
              placeholder="Semua kelompok"
            />
          </div>
          <div className="w-52">
            <SearchableSelect
              label="Masuk laporan"
              value={filterLaporan}
              onChange={setFilterLaporan}
              options={OPSI_FILTER_LAPORAN}
              placeholder="Semua"
            />
          </div>
        </div>
      </Card>

      <Card>
        {memuat ? (
          <Skeleton baris={10} />
        ) : tersaring.length === 0 ? (
          <EmptyState pesan="Tidak ada kode akun yang cocok." />
        ) : (
          <>
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              {tersaring.length} dari {daftar.length} kode
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Kode</th>
                    <th className="px-2 py-2 font-medium">Nama</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Kelompok</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Masuk laporan</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Arus kas</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Dipakai</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Status</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {tersaring.map((k) => (
                    <tr key={k.id} className="border-b border-gray-100 dark:border-zinc-800">
                      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-gray-900 dark:text-gray-50">
                        {k.kode}
                        {k.sistem && (
                          <span title="Kode sistem, tidak bisa dihapus" className="ml-1 inline-flex">
                            <Lock className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{k.nama}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-400">
                        {k.kelompok}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <BadgeLaporan laporan={k.laporan} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <BadgeAktivitas aktivitas={k.aktivitasKas} />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right text-gray-900 dark:text-gray-50">
                        {k._count.transaksi + k._count.rincian}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        {k.aktif ? <Badge warna="hijau">Aktif</Badge> : <Badge>Nonaktif</Badge>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Ubah"
                            aria-label={`Ubah kode ${k.kode}`}
                            onClick={() =>
                              setForm({
                                id: k.id,
                                kode: k.kode,
                                nama: k.nama,
                                kelompok: k.kelompok,
                                laporan: k.laporan,
                                aktivitasKas: k.aktivitasKas,
                              })
                            }
                            className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={k.sistem}
                            onClick={() => toggleAktif(k)}
                            className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-zinc-700"
                          >
                            {k.aktif ? "Nonaktifkan" : "Aktifkan"}
                          </button>
                          <button
                            type="button"
                            title={
                              k.sistem
                                ? "Kode sistem"
                                : k._count.transaksi + k._count.rincian > 0
                                  ? "Sudah dipakai transaksi — nonaktifkan saja"
                                  : "Hapus"
                            }
                            aria-label={`Hapus kode ${k.kode}`}
                            disabled={k.sistem || k._count.transaksi + k._count.rincian > 0}
                            onClick={() => setHapusTarget(k)}
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
          </>
        )}
      </Card>

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus kode akun?"
        pesan={`Kode "${hapusTarget?.kode} — ${hapusTarget?.nama}" akan dihapus permanen.`}
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}
