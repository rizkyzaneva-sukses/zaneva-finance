"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  INPUT_CLASS,
  PageHeader,
  Skeleton,
  Badge,
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { formatRupiah, formatTanggal, tanggalKeIso } from "@/lib/utils";

interface Rekening {
  id: string;
  nama: string;
  bank: string;
  nomorRekening: string | null;
  saldoAwal: string;
  tanggalSaldoAwal: string;
  aktif: boolean;
  urutan: number;
  _count: { transaksi: number };
}

const BANK_OPTIONS = [
  { value: "BCA", label: "BCA" },
  { value: "MANDIRI", label: "Mandiri" },
  { value: "BRI", label: "BRI" },
  { value: "BNI", label: "BNI" },
  { value: "LAINNYA", label: "Lainnya" },
];

interface FormState {
  id: string | null;
  nama: string;
  bank: string | null;
  nomorRekening: string;
  saldoAwal: string;
  tanggalSaldoAwal: string;
}

const FORM_KOSONG: FormState = {
  id: null,
  nama: "",
  bank: null,
  nomorRekening: "",
  saldoAwal: "0",
  tanggalSaldoAwal: tanggalKeIso(new Date()),
};

export default function RekeningPage() {
  const [daftar, setDaftar] = React.useState<Rekening[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [hapusTarget, setHapusTarget] = React.useState<Rekening | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);

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

  return (
    <>
      <PageHeader
        judul="Rekening"
        deskripsi="Daftar rekening yang muncul di dropdown saat merekap. Saldo awal adalah titik nol pembukuan — kalau salah, seluruh saldo ikut salah."
        aksi={
          <Button onClick={() => setForm({ ...FORM_KOSONG })}>
            <Plus className="h-4 w-4" />
            Tambah Rekening
          </Button>
        }
      />

      {form && (
        <Card className="mb-4">
          <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-50">
            {form.id ? "Ubah Rekening" : "Rekening Baru"}
          </h2>
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

            <div className="flex items-end gap-2 sm:col-span-2">
              <Button type="submit" loading={menyimpan}>
                Simpan
              </Button>
              <Button type="button" varian="sekunder" onClick={() => setForm(null)}>
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

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
                    <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{r.bank}</td>
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
