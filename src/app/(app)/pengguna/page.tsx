"use client";

import * as React from "react";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
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
import { formatTanggal } from "@/lib/utils";

interface Pengguna {
  id: string;
  nama: string;
  username: string;
  role: string;
  aktif: boolean;
  createdAt: string;
  brand: { id: string; nama: string }[];
}

const OPSI_ROLE = [
  { value: "OWNER", label: "OWNER", hint: "Akses penuh, kelola pengguna, lihat Log" },
  { value: "ADMIN", label: "ADMIN (Finance)", hint: "Semua kecuali kelola pengguna; meng-ACC pekerjaan STAFF & Bendahara" },
  { value: "STAFF", label: "STAFF", hint: "Rekap & koreksi (menunggu ACC), tanpa hapus" },
  { value: "BENDAHARA", label: "BENDAHARA", hint: "Input manual kas tunai (petty cash) saja, menunggu ACC" },
];

interface FormState {
  id: string | null;
  nama: string;
  username: string;
  password: string;
  role: string | null;
  brandIds: string[];
}

const FORM_KOSONG: FormState = { id: null, nama: "", username: "", password: "", role: "STAFF", brandIds: [] };

export default function PenggunaPage() {
  const [daftar, setDaftar] = React.useState<Pengguna[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [form, setForm] = React.useState<FormState | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [hapusTarget, setHapusTarget] = React.useState<Pengguna | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);
  const [daftarBrand, setDaftarBrand] = React.useState<{ id: string; nama: string }[]>([]);

  React.useEffect(() => {
    fetch("/api/brand")
      .then((r) => (r.ok ? r.json() : { brand: [] }))
      .then((d) => setDaftarBrand(d.brand))
      .catch(() => {});
  }, []);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/pengguna");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.pengguna);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat pengguna");
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
    if (!form.role) {
      toast.error("Role wajib dipilih");
      return;
    }
    setMenyimpan(true);
    try {
      const body: Record<string, unknown> = { nama: form.nama, role: form.role, brandIds: form.brandIds };
      if (!form.id) {
        body.username = form.username;
        body.password = form.password;
      } else if (form.password) {
        body.password = form.password;
      }

      const res = await fetch(form.id ? `/api/pengguna/${form.id}` : "/api/pengguna", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(form.id ? "Pengguna diperbarui" : "Pengguna dibuat");
      setForm(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  async function toggleAktif(p: Pengguna) {
    try {
      const res = await fetch(`/api/pengguna/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktif: !p.aktif }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(p.aktif ? "Akun dinonaktifkan" : "Akun diaktifkan");
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah status");
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/pengguna/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("Pengguna dihapus");
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
        judul="Pengguna"
        deskripsi="Akun tim yang bisa masuk ke app ini. Setiap input dan koreksi transaksi tercatat atas nama akunnya."
        aksi={
          <Button onClick={() => setForm({ ...FORM_KOSONG })}>
            <Plus className="h-4 w-4" />
            Tambah Pengguna
          </Button>
        }
      />

      <Modal
        buka={form !== null}
        judul={form?.id ? `Ubah ${form.username}` : "Pengguna Baru"}
        onTutup={() => setForm(null)}
      >
        {form && (
          <form onSubmit={simpan} className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lengkap" required>
              <input
                required
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label="Username"
              required={!form.id}
              hint={form.id ? "Username tidak bisa diubah" : "Huruf kecil, angka, titik, strip"}
            >
              <input
                required={!form.id}
                disabled={!!form.id}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase() })}
                className={INPUT_CLASS}
              />
            </Field>

            <Field
              label={form.id ? "Password baru" : "Password"}
              required={!form.id}
              hint={form.id ? "Kosongkan kalau tidak ingin mengganti" : "Minimal 8 karakter"}
            >
              <input
                type="password"
                required={!form.id}
                autoComplete="new-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>

            <SearchableSelect
              label="Role"
              required
              value={form.role}
              onChange={(v) => setForm({ ...form, role: v })}
              options={OPSI_ROLE}
              placeholder="Pilih role"
            />

            {form.role !== "OWNER" && (
              <div className="sm:col-span-2">
                <SearchableSelect
                  multiple
                  label="Akses brand"
                  value={form.brandIds}
                  onChange={(v) => setForm({ ...form, brandIds: v })}
                  options={daftarBrand.map((b) => ({ value: b.id, label: b.nama }))}
                  placeholder="Semua brand"
                  emptyText="Belum ada brand. Tambahkan di Master → Brand."
                />
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                  {form.brandIds.length === 0
                    ? "Kosong = bisa mengakses semua brand. Pilih satu atau lebih untuk membatasi."
                    : "Hanya melihat dan mengelola rekening milik brand ini: transaksi, rekap, dokumen, dashboard, dan laporannya. Alokasi, Stok & HPP, Kode Akun, dan Brand tidak tersedia untuk akun yang dibatasi."}
                </p>
              </div>
            )}

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
          <EmptyState pesan="Belum ada pengguna." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Nama</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Username</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Role</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Brand</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Dibuat</th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Status</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {daftar.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-2 py-2 font-medium text-gray-900 dark:text-gray-50">
                      {p.nama}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                      {p.username}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <Badge warna={p.role === "OWNER" ? "biru" : "abu"}>{p.role}</Badge>
                    </td>
                    <td className="px-2 py-2">
                      {p.role === "OWNER" || p.brand.length === 0 ? (
                        <span className="text-xs text-gray-600 dark:text-gray-400">Semua brand</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {p.brand.map((b) => (
                            <Badge key={b.id} warna="biru">
                              {b.nama}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-400">
                      {formatTanggal(p.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      {p.aktif ? <Badge warna="hijau">Aktif</Badge> : <Badge>Nonaktif</Badge>}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          title="Ubah / ganti password"
                          aria-label={`Ubah ${p.username}`}
                          onClick={() =>
                            setForm({
                              id: p.id,
                              nama: p.nama,
                              username: p.username,
                              password: "",
                              role: p.role,
                              brandIds: p.brand.map((b) => b.id),
                            })
                          }
                          className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleAktif(p)}
                          className="rounded px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                        >
                          {p.aktif ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        <button
                          type="button"
                          title="Hapus"
                          aria-label={`Hapus ${p.username}`}
                          onClick={() => setHapusTarget(p)}
                          className="rounded p-1.5 text-gray-600 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
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

      <p className="mt-3 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
        <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Akun <code className="font-mono">admin</code> masih memakai password bawaan hasil seed. Ganti
        sekarang lewat tombol ubah di atas.
      </p>

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus pengguna?"
        pesan={`Akun "${hapusTarget?.username}" akan dihapus permanen. Kalau akun ini pernah menginput transaksi, nonaktifkan saja supaya jejaknya tetap utuh.`}
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}
