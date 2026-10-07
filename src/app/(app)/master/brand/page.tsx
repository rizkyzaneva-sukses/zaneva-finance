"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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
} from "@/components/ui/primitives";

interface Brand {
  id: string;
  nama: string;
  _count: { produk: number; rekening: number; penugasan: number };
}

export default function BrandPage() {
  const [daftar, setDaftar] = React.useState<Brand[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [form, setForm] = React.useState<{ id: string | null; nama: string } | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [hapusTarget, setHapusTarget] = React.useState<Brand | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/brand");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.brand);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat brand");
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
    setMenyimpan(true);
    try {
      const res = await fetch(form.id ? `/api/brand/${form.id}` : "/api/brand", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama: form.nama }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(form.id ? "Nama brand diperbarui" : "Brand ditambahkan");
      setForm(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/brand/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("Brand dihapus");
      setHapusTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
      setHapusTarget(null);
    } finally {
      setMenghapus(false);
    }
  }

  return (
    <>
      <PageHeader
        judul="Brand"
        deskripsi="Daftar brand. Rekening diberi brand di menu Rekening, produk di Stok & HPP, dan pengguna dibatasi ke brand tertentu di menu Pengguna."
        aksi={
          <Button onClick={() => setForm({ id: null, nama: "" })}>
            <Plus className="h-4 w-4" />
            Tambah Brand
          </Button>
        }
      />

      <Modal
        buka={form !== null}
        judul={form?.id ? "Ganti nama brand" : "Brand baru"}
        deskripsi={form?.id ? "Produk, rekening, dan SO lama ikut memakai nama baru." : undefined}
        onTutup={() => setForm(null)}
      >
        {form && (
          <form onSubmit={simpan} className="space-y-4">
            <Field label="Nama brand" required hint={`Penulisan dianggap sama kalau huruf dan angkanya sama ("BE SYAR'I" = "BESYARI").`}>
              <input
                required
                autoFocus
                maxLength={60}
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
            <div className="flex justify-end gap-2">
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
            pesan="Belum ada brand. Tambahkan di sini, atau otomatis dibuat saat unggah master produk."
            aksi={
              <Button onClick={() => setForm({ id: null, nama: "" })}>
                <Plus className="h-4 w-4" />
                Tambah Brand
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="px-2 py-2 font-medium">Brand</th>
                  <th className="px-2 py-2 text-right font-medium">Rekening</th>
                  <th className="px-2 py-2 text-right font-medium">Produk (SKU)</th>
                  <th className="px-2 py-2 text-right font-medium">Pengguna dibatasi</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100 dark:border-zinc-800">
                    <td className="px-2 py-2 font-medium text-gray-900 dark:text-gray-50">{b.nama}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">{b._count.rekening}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">{b._count.produk}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">{b._count.penugasan}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        title="Ganti nama"
                        aria-label={`Ganti nama ${b.nama}`}
                        onClick={() => setForm({ id: b.id, nama: b.nama })}
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="Hapus"
                        aria-label={`Hapus ${b.nama}`}
                        onClick={() => setHapusTarget(b)}
                        className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus brand?"
        pesan={`Brand "${hapusTarget?.nama}" dihapus. Hanya bisa kalau belum dipakai rekening, produk, SO, atau pengguna manapun.`}
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}
