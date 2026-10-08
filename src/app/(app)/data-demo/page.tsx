"use client";

import * as React from "react";
import { Database, Eraser, RotateCcw, Sparkles, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  INPUT_CLASS,
  Modal,
  PageHeader,
  Skeleton,
} from "@/components/ui/primitives";

interface Status {
  brand: number;
  rekening: number;
  transaksi: number;
  produk: number;
  dokumen: number;
  stokOpname: number;
  periodeLaba: number;
  pengguna: number;
}

const LABEL_STATUS: { key: keyof Status; label: string }[] = [
  { key: "brand", label: "Brand" },
  { key: "rekening", label: "Rekening" },
  { key: "transaksi", label: "Transaksi" },
  { key: "produk", label: "Produk" },
  { key: "dokumen", label: "Dokumen" },
  { key: "stokOpname", label: "Stok Opname" },
  { key: "periodeLaba", label: "Periode Laba" },
  { key: "pengguna", label: "Pengguna" },
];

export default function DataDemoPage() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [memuat, setMemuat] = React.useState(true);
  const [sibuk, setSibuk] = React.useState<"isi" | "hapus" | "reset" | null>(null);

  const [modalReset, setModalReset] = React.useState(false);
  const [teksKonfirmasi, setTeksKonfirmasi] = React.useState("");
  const [konfirmHapusDummy, setKonfirmHapusDummy] = React.useState(false);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/data-demo");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data.status);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat status data");
    } finally {
      setMemuat(false);
    }
  }, []);

  React.useEffect(() => {
    muat();
  }, [muat]);

  async function jalankan(aksi: "isi" | "hapus" | "reset", konfirmasi?: string) {
    setSibuk(aksi);
    try {
      const res = await fetch("/api/data-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi, konfirmasi }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.pesan ?? "Berhasil");
      await muat();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menjalankan aksi");
      return false;
    } finally {
      setSibuk(null);
    }
  }

  async function konfirmasiReset() {
    const ok = await jalankan("reset", teksKonfirmasi);
    if (ok) {
      setModalReset(false);
      setTeksKonfirmasi("");
    }
  }

  async function hapusDummy() {
    const ok = await jalankan("hapus");
    if (ok) setKonfirmHapusDummy(false);
  }

  const adaData = status ? status.brand + status.rekening + status.transaksi > 0 : false;

  return (
    <>
      <PageHeader
        judul="Data & Demo"
        deskripsi="Khusus OWNER. Isi data contoh untuk semua fitur, atau bersihkan seluruh data sebelum dipakai sungguhan."
      />

      {/* ── Status data ─────────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Data saat ini</h2>
        </div>
        {memuat ? (
          <Skeleton baris={2} />
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LABEL_STATUS.map((s) => (
              <div key={s.key} className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700">
                <div className="text-xs text-gray-600 dark:text-gray-400">{s.label}</div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-50">
                  {status ? status[s.key].toLocaleString("id-ID") : "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Isi data contoh ─────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Isi data contoh</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Membuat data lengkap untuk <strong>semua brand</strong> dan <strong>semua fitur</strong>: rekening &
              transaksi 3 bulan, produk + stok opname &amp; selisih HPP, dokumen arsip, tutup buku &amp; distribusi
              alokasi, user demo, dan beberapa transaksi menunggu ACC.
            </p>
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Semua data bertanda <code className="font-mono">[DUMMY]</code> — bisa dihapus kapan saja lewat tombol di
              bawah tanpa mengganggu data asli.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button onClick={() => jalankan("isi")} loading={sibuk === "isi"} disabled={sibuk !== null}>
                <Sparkles className="h-4 w-4" /> Isi data contoh
              </Button>
              <Button
                varian="sekunder"
                onClick={() => setKonfirmHapusDummy(true)}
                loading={sibuk === "hapus"}
                disabled={sibuk !== null}
              >
                <Eraser className="h-4 w-4" /> Hapus data contoh saja
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Akun demo ───────────────────────────────────── */}
      <Card className="mb-4">
        <div className="flex items-start gap-3">
          <Users className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Akun demo</h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Setelah &quot;Isi data contoh&quot;, ada akun untuk mencoba alur role &amp; pembatasan brand:
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <li>
                <code className="font-mono">demo.finance</code> — ADMIN (Finance), akses semua brand; meng-ACC final
                koreksi kode/catatan/split. Password <code className="font-mono">dummy1234</code>
              </li>
              <li>
                <code className="font-mono">demo.bendahara</code> — BENDAHARA, pegang petty cash (input langsung masuk
                tanpa ACC) &amp; verifikasi input staff (ACC tahap 1). Password <code className="font-mono">dummy1234</code>
              </li>
              <li>
                <code className="font-mono">demo.zanevamuslimah</code> (dan sejenisnya) — STAFF, dibatasi ke satu brand
                saja. Password <code className="font-mono">dummy1234</code>
              </li>
            </ul>
          </div>
        </div>
      </Card>

      {/* ── Reset semua data ────────────────────────────── */}
      <Card
        className={
          adaData
            ? "border-red-300 bg-red-50/60 dark:border-red-900/60 dark:bg-red-950/20"
            : "border-red-300 dark:border-red-900/60"
        }
      >
        <div className="flex items-start gap-3">
          <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">Reset seluruh data</h2>
              {adaData && <Badge warna="merah">Ada {status?.transaksi.toLocaleString("id-ID")} transaksi</Badge>}
            </div>
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
              Hapus <strong>permanen</strong> semua brand, rekening, transaksi, dokumen, produk, stok opname, alokasi,
              dan log. <strong>Akun pengguna &amp; Kode Akun tetap disimpan</strong> — jadi kamu tidak perlu seed ulang.
            </p>
            <p className="mt-2 text-xs text-red-700 dark:text-red-400">
              Tindakan ini tidak bisa dibatalkan. Backup database dulu kalau ragu.
            </p>
            <div className="mt-3">
              <Button varian="bahaya" onClick={() => setModalReset(true)} disabled={sibuk !== null}>
                <RotateCcw className="h-4 w-4" /> Reset semua data
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal reset dengan gerbang ketik RESET */}
      <Modal
        buka={modalReset}
        judul="Reset seluruh data?"
        onTutup={() => {
          if (sibuk !== "reset") {
            setModalReset(false);
            setTeksKonfirmasi("");
          }
        }}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Ini akan menghapus semua data operasional secara permanen. Untuk memastikan, ketik{" "}
            <code className="font-mono font-semibold">RESET</code> di bawah ini.
          </p>
          <input
            value={teksKonfirmasi}
            onChange={(e) => setTeksKonfirmasi(e.target.value)}
            className={INPUT_CLASS}
            placeholder="RESET"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              varian="sekunder"
              onClick={() => {
                setModalReset(false);
                setTeksKonfirmasi("");
              }}
              disabled={sibuk === "reset"}
            >
              Batal
            </Button>
            <Button
              varian="bahaya"
              onClick={konfirmasiReset}
              loading={sibuk === "reset"}
              disabled={teksKonfirmasi.trim().toUpperCase() !== "RESET"}
            >
              Hapus semua data
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        buka={konfirmHapusDummy}
        judul="Hapus data contoh saja?"
        pesan="Hanya data bertanda [DUMMY] (brand, rekening, produk, transaksi, dokumen demo) yang dihapus. Data asli tidak tersentuh."
        labelKonfirmasi="Hapus contoh"
        loading={sibuk === "hapus"}
        onKonfirmasi={hapusDummy}
        onBatal={() => setKonfirmHapusDummy(false)}
      />
    </>
  );
}
