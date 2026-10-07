"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  INPUT_CLASS,
  PageHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface EntriLog {
  id: string;
  entitas: string;
  entitasId: string;
  aksi: "BUAT" | "UBAH" | "HAPUS";
  dataLama: Record<string, unknown> | null;
  dataBaru: Record<string, unknown> | null;
  createdAt: string;
  label: string | null;
  user: { nama: string; username: string } | null;
}

const OPSI_ENTITAS = [
  { value: "Transaksi", label: "Transaksi" },
  { value: "KodeAkun", label: "Kode Akun" },
  { value: "Rekening", label: "Rekening" },
  { value: "PeriodeLaba", label: "Pengesahan Laba" },
  { value: "DistribusiAlokasi", label: "Distribusi Alokasi" },
];

const OPSI_AKSI = [
  { value: "UBAH", label: "Ubah" },
  { value: "HAPUS", label: "Hapus" },
  { value: "BUAT", label: "Buat" },
];

const NAMA_FIELD: Record<string, string> = {
  kode: "Kode",
  nama: "Nama",
  catatan: "Catatan",
  statusKode: "Status kode",
  statusAcc: "Status ACC",
  laporan: "Masuk laporan",
  aktivitasKas: "Arus kas",
  persenAlokasi: "% Alokasi",
  aktif: "Aktif",
  saldoAwal: "Saldo awal",
  split: "Split",
  keterangan: "Keterangan",
  tanggal: "Tanggal",
  uangMasuk: "Uang masuk",
  uangKeluar: "Uang keluar",
  periode: "Periode",
  labaBersih: "Laba bersih",
  labaDasar: "Laba dasar",
  totalDibagikan: "Total dibagikan",
  totalPersen: "Total %",
  jumlahKode: "Jumlah kode",
  saldoAwalAlokasi: "Saldo awal alokasi",
  bank: "Jenis rekening",
};

const waktu = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));

function tampil(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  if (Array.isArray(v)) return v.length === 0 ? "—" : `${v.length} rincian`;
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** Hanya field yang benar-benar berubah — selebihnya cuma kebisingan. */
function Perubahan({ e }: { e: EntriLog }) {
  const lama = e.dataLama ?? {};
  const baru = e.dataBaru ?? {};

  if (e.aksi === "HAPUS") {
    const ringkas = Object.entries(lama)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => `${NAMA_FIELD[k] ?? k}: ${tampil(v)}`);
    return (
      <span className="text-xs text-gray-600 dark:text-gray-400">
        {ringkas.length ? `Data terakhir — ${ringkas.join(" · ")}` : "Dihapus"}
      </span>
    );
  }

  const kunci = [...new Set([...Object.keys(lama), ...Object.keys(baru)])].filter(
    (k) => JSON.stringify(lama[k]) !== JSON.stringify(baru[k])
  );
  if (kunci.length === 0) {
    return <span className="text-xs text-gray-600 dark:text-gray-400">Tidak ada nilai yang berubah</span>;
  }
  return (
    <ul className="space-y-0.5">
      {kunci.map((k) => (
        <li key={k} className="flex flex-wrap items-center gap-1 text-xs text-gray-900 dark:text-gray-50">
          <span className="font-medium">{NAMA_FIELD[k] ?? k}:</span>
          <span className="text-gray-600 line-through dark:text-gray-400">{tampil(lama[k])}</span>
          <ArrowRight className="h-3 w-3 shrink-0 text-gray-500 dark:text-gray-400" />
          <span>{tampil(baru[k])}</span>
        </li>
      ))}
    </ul>
  );
}

export default function LogPage() {
  const [log, setLog] = React.useState<EntriLog[]>([]);
  const [total, setTotal] = React.useState(0);
  const [halaman, setHalaman] = React.useState(1);
  const [pengguna, setPengguna] = React.useState<{ id: string; nama: string; username: string }[]>([]);
  const [memuat, setMemuat] = React.useState(true);

  const [entitas, setEntitas] = React.useState<string | null>(null);
  const [aksi, setAksi] = React.useState<string | null>(null);
  const [userId, setUserId] = React.useState<string | null>(null);
  const [dari, setDari] = React.useState("");
  const [sampai, setSampai] = React.useState("");

  const perHalaman = 50;

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const q = new URLSearchParams({ halaman: String(halaman), perHalaman: String(perHalaman) });
      if (entitas) q.set("entitas", entitas);
      if (aksi) q.set("aksi", aksi);
      if (userId) q.set("userId", userId);
      if (dari) q.set("dari", dari);
      if (sampai) q.set("sampai", sampai);
      const res = await fetch(`/api/log?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLog(data.log);
      setTotal(data.total);
      setPengguna(data.pengguna);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat log");
    } finally {
      setMemuat(false);
    }
  }, [halaman, entitas, aksi, userId, dari, sampai]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setHalaman(1);
  };

  return (
    <>
      <PageHeader
        judul="Log Aktivitas"
        deskripsi="Jejak siapa mengubah apa, kapan, dan dari nilai berapa ke berapa. Hanya OWNER yang bisa melihat halaman ini."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchableSelect
            label="Objek"
            value={entitas}
            onChange={reset(setEntitas)}
            options={OPSI_ENTITAS}
            placeholder="Semua"
          />
          <SearchableSelect
            label="Aksi"
            value={aksi}
            onChange={reset(setAksi)}
            options={OPSI_AKSI}
            placeholder="Semua"
          />
          <SearchableSelect
            label="Pengguna"
            value={userId}
            onChange={reset(setUserId)}
            options={pengguna.map((p) => ({ value: p.id, label: p.nama, hint: p.username }))}
            placeholder="Semua"
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Dari</label>
            <input type="date" value={dari} onChange={(e) => reset(setDari)(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Sampai</label>
            <input type="date" value={sampai} onChange={(e) => reset(setSampai)(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>
      </Card>

      <Card>
        {memuat ? (
          <Skeleton baris={8} />
        ) : log.length === 0 ? (
          <EmptyState pesan="Belum ada aktivitas yang cocok dengan filter ini." />
        ) : (
          <>
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              {total} entri · halaman {halaman} dari {totalHalaman}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Waktu (WIB)</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Pengguna</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Aksi</th>
                    <th className="min-w-48 px-2 py-2 font-medium">Objek</th>
                    <th className="min-w-64 px-2 py-2 font-medium">Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {log.map((e) => (
                    <tr key={e.id} className="border-b border-gray-100 align-top dark:border-zinc-800">
                      <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">{waktu(e.createdAt)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                        {e.user?.nama ?? <span className="text-gray-500">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2">
                        <Badge warna={e.aksi === "HAPUS" ? "merah" : e.aksi === "BUAT" ? "hijau" : "biru"}>
                          {e.aksi === "HAPUS" ? "Hapus" : e.aksi === "BUAT" ? "Buat" : "Ubah"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-gray-900 dark:text-gray-50">
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {OPSI_ENTITAS.find((o) => o.value === e.entitas)?.label ?? e.entitas}
                        </div>
                        {e.label ?? <span className="font-mono text-xs text-gray-500">{e.entitasId}</span>}
                      </td>
                      <td className="px-2 py-2">
                        <Perubahan e={e} />
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
    </>
  );
}
