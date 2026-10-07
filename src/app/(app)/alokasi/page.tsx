"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock, Pencil, ShieldCheck, Undo2 } from "lucide-react";
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
import { cn, formatRupiah } from "@/lib/utils";

interface KodeAlokasi {
  id: string;
  kode: string;
  nama: string;
  aktif: boolean;
  persen: number | null;
  saldoAwal: number;
  totalJatah: number;
  terpakai: number;
  saldo: number;
}

interface ItemDistribusi {
  kodeAkunId: string;
  kode: string;
  nama: string;
  persen: number;
  nominal: number;
}

interface Periode {
  tahun: number;
  bulan: number;
  labaLive: number;
  belumMasuk: { jumlahTransaksi: number; nilai: number };
  menungguAcc: number;
  disahkan: { id: string; labaBersih: number; oleh: string; pada: string } | null;
  berubah: boolean;
  distribusi: { oleh: string; pada: string; total: number; item: ItemDistribusi[] } | null;
  pratinjau: ItemDistribusi[] | null;
}

interface DataAlokasi {
  kode: KodeAlokasi[];
  periode: Periode[];
  totalPersen: number;
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const tgl = (iso: string) =>
  new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(
    new Date(iso)
  );

function Rp({ n, tebal }: { n: number; tebal?: boolean }) {
  return (
    <span
      className={cn(
        "tabular-nums",
        tebal && "font-semibold",
        n < 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-50"
      )}
    >
      {n < 0 ? `(${formatRupiah(-n)})` : formatRupiah(n)}
    </span>
  );
}

type Aksi =
  | { jenis: "acc-laba"; p: Periode }
  | { jenis: "buka-laba"; p: Periode }
  | { jenis: "distribusi"; p: Periode }
  | { jenis: "batal-distribusi"; p: Periode };

export default function AlokasiPage() {
  const [data, setData] = React.useState<DataAlokasi | null>(null);
  const [role, setRole] = React.useState<string | null>(null);
  const [memuat, setMemuat] = React.useState(true);
  const [aksi, setAksi] = React.useState<Aksi | null>(null);
  const [memproses, setMemproses] = React.useState(false);
  const [saldoAwal, setSaldoAwal] = React.useState<{ kode: KodeAlokasi; nilai: string } | null>(null);
  const [tampilSemua, setTampilSemua] = React.useState(false);

  const isOwner = role === "OWNER";

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const [res, me] = await Promise.all([fetch("/api/alokasi"), fetch("/api/auth/me")]);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      if (me.ok) setRole((await me.json()).user.role);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat alokasi");
    } finally {
      setMemuat(false);
    }
  }, []);

  React.useEffect(() => {
    muat();
  }, [muat]);

  async function jalankan() {
    if (!aksi) return;
    const { p } = aksi;
    setMemproses(true);
    try {
      let res: Response;
      if (aksi.jenis === "acc-laba") {
        res = await fetch("/api/alokasi/tutup-buku", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tahun: p.tahun, bulan: p.bulan }),
        });
      } else if (aksi.jenis === "buka-laba") {
        res = await fetch(`/api/alokasi/tutup-buku?tahun=${p.tahun}&bulan=${p.bulan}`, { method: "DELETE" });
      } else if (aksi.jenis === "distribusi") {
        res = await fetch("/api/alokasi/distribusi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tahun: p.tahun, bulan: p.bulan }),
        });
      } else {
        res = await fetch(`/api/alokasi/distribusi?tahun=${p.tahun}&bulan=${p.bulan}`, { method: "DELETE" });
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error);
      toast.success(
        {
          "acc-laba": "Laba disahkan",
          "buka-laba": "Pengesahan laba dibuka kembali",
          distribusi: "Distribusi alokasi disahkan",
          "batal-distribusi": "Distribusi dibatalkan",
        }[aksi.jenis]
      );
      setAksi(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses");
    } finally {
      setMemproses(false);
    }
  }

  async function simpanSaldoAwal(e: React.FormEvent) {
    e.preventDefault();
    if (!saldoAwal) return;
    setMemproses(true);
    try {
      const res = await fetch(`/api/kode-akun/${saldoAwal.kode.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saldoAwalAlokasi: saldoAwal.nilai === "" ? 0 : saldoAwal.nilai }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success("Saldo awal tersimpan");
      setSaldoAwal(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMemproses(false);
    }
  }

  const kodeBerpersen = data?.kode.filter((k) => k.persen !== null) ?? [];
  // Kode alokasi yang tidak pernah disentuh (tanpa persen, saldo, jatah, maupun pemakaian)
  // disembunyikan supaya yang penting tidak tenggelam. Totalnya tetap dihitung dari semua.
  const relevan = (k: KodeAlokasi) =>
    k.persen !== null || k.saldoAwal !== 0 || k.totalJatah !== 0 || k.terpakai !== 0;
  const kodeTampil = (data?.kode ?? []).filter((k) => tampilSemua || relevan(k));
  const jumlahTersembunyi = (data?.kode ?? []).filter((k) => !relevan(k)).length;
  const total = (f: (k: KodeAlokasi) => number) =>
    Math.round((data?.kode ?? []).reduce((s, k) => s + f(k), 0) * 100) / 100;

  const judulAksi = aksi && {
    "acc-laba": `Sahkan laba ${NAMA_BULAN[aksi.p.bulan - 1]} ${aksi.p.tahun}?`,
    "buka-laba": `Buka kembali laba ${NAMA_BULAN[aksi.p.bulan - 1]} ${aksi.p.tahun}?`,
    distribusi: `Sahkan distribusi ${NAMA_BULAN[aksi.p.bulan - 1]} ${aksi.p.tahun}`,
    "batal-distribusi": `Batalkan distribusi ${NAMA_BULAN[aksi.p.bulan - 1]} ${aksi.p.tahun}?`,
  }[aksi.jenis];

  return (
    <>
      <PageHeader
        judul="Alokasi"
        deskripsi="Saldo jatah dari laba (ZIS, Alokasi R, dst). Bertambah saat distribusi laba disahkan, berkurang saat dipakai lewat mutasi berkode itu."
      />

      {data && data.totalPersen > 100 && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Total persentase alokasi <strong>{data.totalPersen}%</strong> melebihi 100%, distribusi akan ditolak.{" "}
            <Link href="/master/kode-akun" className="font-medium underline">
              Perbaiki di Kode Akun
            </Link>
          </span>
        </div>
      )}

      <Card className="mb-4">
        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">Saldo alokasi</h2>
        <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
          Saldo = saldo awal + jatah yang sudah disahkan − pemakaian dari mutasi. Pemakaian dihitung dari
          transaksi berkode itu, termasuk rincian split.
        </p>
        {memuat && !data ? (
          <Skeleton baris={6} />
        ) : !data || data.kode.length === 0 ? (
          <EmptyState
            pesan="Belum ada kode alokasi yang punya persentase. Isi persentase di halaman Kode Akun."
            aksi={
              <Link href="/master/kode-akun">
                <Button>Ke Kode Akun</Button>
              </Link>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Kode</th>
                  <th className="px-2 py-2 font-medium">Nama</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">%</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo awal</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Jatah disahkan</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Terpakai</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {kodeTampil.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 dark:border-zinc-800">
                    <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-gray-900 dark:text-gray-50">
                      {k.kode}
                    </td>
                    <td className="px-2 py-2 text-gray-900 dark:text-gray-50">
                      {k.nama}
                      {!k.aktif && (
                        <span className="ml-2">
                          <Badge>Nonaktif</Badge>
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                      {k.persen === null ? "—" : `${k.persen}%`}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Rp n={k.saldoAwal} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Rp n={k.totalJatah} />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Link
                        href={`/transaksi?kodeAkunId=${k.id}`}
                        title="Lihat transaksi pemakaian"
                        className="underline decoration-dotted underline-offset-2"
                      >
                        <Rp n={k.terpakai} />
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <Rp n={k.saldo} tebal />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <button
                        type="button"
                        title="Atur saldo awal"
                        aria-label={`Atur saldo awal ${k.nama}`}
                        onClick={() =>
                          setSaldoAwal({ kode: k, nilai: k.saldoAwal === 0 ? "" : String(k.saldoAwal) })
                        }
                        className="rounded p-1.5 text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 dark:border-zinc-600">
                  <td colSpan={2} className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-50">
                    Total
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                    {kodeBerpersen.length ? `${data.totalPersen}%` : "—"}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Rp n={total((k) => k.saldoAwal)} tebal />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Rp n={total((k) => k.totalJatah)} tebal />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Rp n={total((k) => k.terpakai)} tebal />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 text-right">
                    <Rp n={total((k) => k.saldo)} tebal />
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
            {jumlahTersembunyi > 0 && (
              <label className="mt-3 flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={tampilSemua}
                  onChange={(e) => setTampilSemua(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                />
                Tampilkan {jumlahTersembunyi} kode alokasi lain yang belum punya persen maupun pemakaian
              </label>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">Tutup buku & distribusi per bulan</h2>
        <p className="mb-4 text-xs text-gray-600 dark:text-gray-400">
          Urutannya: <strong>OWNER</strong> mengesahkan laba bersih bulan itu, lalu <strong>Finance (ADMIN)</strong>{" "}
          mengesahkan pembagian jatah. Jatah dihitung dari laba yang disahkan, bukan dari laba yang berubah
          belakangan.
        </p>

        {memuat && !data ? (
          <Skeleton baris={4} />
        ) : (
          <div className="space-y-3">
            {data?.periode.map((p) => {
              const nama = `${NAMA_BULAN[p.bulan - 1]} ${p.tahun}`;
              return (
                <div
                  key={`${p.tahun}-${p.bulan}`}
                  className="rounded-lg border border-gray-200 p-3 dark:border-zinc-700"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-50">{nama}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Laba bersih saat ini: <Rp n={p.labaLive} />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.distribusi ? (
                        <Badge warna="hijau">
                          <CheckCircle2 className="mr-1 inline h-3 w-3" />
                          Terdistribusi
                        </Badge>
                      ) : p.disahkan ? (
                        <Badge warna="biru">
                          <Clock className="mr-1 inline h-3 w-3" />
                          Menunggu distribusi
                        </Badge>
                      ) : (
                        <Badge warna="kuning">Laba belum disahkan</Badge>
                      )}
                    </div>
                  </div>

                  {(p.belumMasuk.jumlahTransaksi > 0 || p.menungguAcc > 0) && !p.distribusi && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        {p.belumMasuk.jumlahTransaksi > 0 &&
                          `${p.belumMasuk.jumlahTransaksi} transaksi belum masuk Laba Rugi (kodenya belum diatur), jadi laba bisa tidak lengkap. `}
                        {p.menungguAcc > 0 && `${p.menungguAcc} transaksi masih menunggu ACC. `}
                        <Link href="/laporan" className="font-medium underline">
                          Periksa di Laporan
                        </Link>
                      </span>
                    </div>
                  )}

                  {p.disahkan && (
                    <div className="mt-2 flex items-start gap-2 text-xs text-gray-700 dark:text-gray-300">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Laba disahkan <strong>{p.disahkan.oleh}</strong> pada {tgl(p.disahkan.pada)}:{" "}
                        <Rp n={p.disahkan.labaBersih} tebal />
                      </span>
                    </div>
                  )}

                  {p.berubah && p.disahkan && (
                    <div className="mt-2 flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900 dark:bg-red-900/30 dark:text-red-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>
                        Laba sekarang <Rp n={p.labaLive} /> berbeda dari yang disahkan <Rp n={p.disahkan.labaBersih} />. Ada
                        transaksi bulan ini yang berubah sejak disahkan.
                        {p.distribusi
                          ? " Distribusi sudah terlanjur dibagikan dari angka yang disahkan."
                          : " OWNER perlu mengesahkan ulang sebelum dibagikan."}
                      </span>
                    </div>
                  )}

                  {p.distribusi && (
                    <div className="mt-3 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                            <th className="px-2 py-1.5 font-medium">Kode</th>
                            <th className="px-2 py-1.5 font-medium">Nama</th>
                            <th className="px-2 py-1.5 text-right font-medium">%</th>
                            <th className="px-2 py-1.5 text-right font-medium">Jatah</th>
                          </tr>
                        </thead>
                        <tbody>
                          {p.distribusi.item.map((d) => (
                            <tr key={d.kodeAkunId} className="border-b border-gray-100 dark:border-zinc-800">
                              <td className="px-2 py-1.5 font-mono text-gray-900 dark:text-gray-50">{d.kode}</td>
                              <td className="px-2 py-1.5 text-gray-900 dark:text-gray-50">{d.nama}</td>
                              <td className="px-2 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">
                                {d.persen}%
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <Rp n={d.nominal} />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="px-2 py-1.5 font-semibold text-gray-900 dark:text-gray-50">
                              Total dibagikan (disahkan {p.distribusi.oleh}, {tgl(p.distribusi.pada)})
                            </td>
                            <td className="px-2 py-1.5 text-right">
                              <Rp n={p.distribusi.total} tebal />
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {!p.disahkan && isOwner && (
                      <Button onClick={() => setAksi({ jenis: "acc-laba", p })}>
                        <ShieldCheck className="h-4 w-4" />
                        Sahkan laba
                      </Button>
                    )}
                    {!p.disahkan && !isOwner && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Menunggu OWNER mengesahkan laba bulan ini.
                      </span>
                    )}
                    {p.disahkan && p.berubah && !p.distribusi && isOwner && (
                      <Button varian="sekunder" onClick={() => setAksi({ jenis: "acc-laba", p })}>
                        Sahkan ulang laba
                      </Button>
                    )}
                    {p.disahkan && !p.distribusi && isOwner && (
                      <Button varian="sekunder" onClick={() => setAksi({ jenis: "buka-laba", p })}>
                        <Undo2 className="h-4 w-4" />
                        Buka kembali
                      </Button>
                    )}
                    {p.disahkan && !p.distribusi && (
                      <Button
                        varian="sukses"
                        disabled={p.berubah || p.disahkan.labaBersih <= 0 || !p.pratinjau?.length}
                        onClick={() => setAksi({ jenis: "distribusi", p })}
                        title={
                          p.berubah
                            ? "Laba berubah sejak disahkan, sahkan ulang dulu"
                            : p.disahkan.labaBersih <= 0
                              ? "Laba nol atau rugi, tidak ada yang dibagikan"
                              : undefined
                        }
                      >
                        Lihat & sahkan distribusi
                      </Button>
                    )}
                    {p.disahkan && !p.distribusi && p.disahkan.labaBersih <= 0 && (
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        Laba nol atau rugi — tidak ada yang dibagikan.
                      </span>
                    )}
                    {p.distribusi && isOwner && (
                      <Button varian="bahaya" onClick={() => setAksi({ jenis: "batal-distribusi", p })}>
                        Batalkan distribusi
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        buka={aksi?.jenis === "distribusi"}
        judul={judulAksi ?? ""}
        deskripsi="Dibagikan dari laba yang sudah disahkan OWNER, dengan persentase saat ini."
        lebar="lg"
        onTutup={() => setAksi(null)}
      >
        {aksi?.jenis === "distribusi" && aksi.p.pratinjau && aksi.p.disahkan && (
          <>
            <div className="mb-3 text-sm text-gray-900 dark:text-gray-50">
              Laba dasar: <Rp n={aksi.p.disahkan.labaBersih} tebal />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="px-2 py-1.5 font-medium">Kode</th>
                    <th className="px-2 py-1.5 font-medium">Nama</th>
                    <th className="px-2 py-1.5 text-right font-medium">%</th>
                    <th className="px-2 py-1.5 text-right font-medium">Jatah</th>
                  </tr>
                </thead>
                <tbody>
                  {aksi.p.pratinjau.map((d) => (
                    <tr key={d.kodeAkunId} className="border-b border-gray-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 font-mono text-xs text-gray-900 dark:text-gray-50">{d.kode}</td>
                      <td className="px-2 py-1.5 text-gray-900 dark:text-gray-50">{d.nama}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-gray-900 dark:text-gray-50">{d.persen}%</td>
                      <td className="px-2 py-1.5 text-right">
                        <Rp n={d.nominal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-300 dark:border-zinc-600">
                    <td colSpan={3} className="px-2 py-2 font-semibold text-gray-900 dark:text-gray-50">
                      Total dibagikan
                    </td>
                    <td className="px-2 py-2 text-right">
                      <Rp n={aksi.p.pratinjau.reduce((s, d) => s + d.nominal, 0)} tebal />
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400">
                      Tidak dialokasikan ({Math.round((100 - (data?.totalPersen ?? 0)) * 100) / 100}%)
                    </td>
                    <td className="px-2 py-1 text-right text-xs">
                      <Rp n={aksi.p.disahkan.labaBersih - aksi.p.pratinjau.reduce((s, d) => s + d.nominal, 0)} />
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
              Setelah disahkan, jatah langsung masuk ke saldo alokasi. Hanya OWNER yang bisa membatalkannya.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button varian="sekunder" onClick={() => setAksi(null)}>
                Batal
              </Button>
              <Button varian="sukses" loading={memproses} onClick={jalankan}>
                Sahkan distribusi
              </Button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        buka={aksi !== null && aksi.jenis !== "distribusi"}
        judul={judulAksi ?? ""}
        pesan={
          aksi?.jenis === "acc-laba"
            ? `Laba bersih ${NAMA_BULAN[aksi.p.bulan - 1]} ${aksi.p.tahun} sebesar ${formatRupiah(aksi.p.labaLive)} akan disimpan sebagai dasar pembagian alokasi.${
                aksi.p.belumMasuk.jumlahTransaksi > 0
                  ? ` Perhatian: ${aksi.p.belumMasuk.jumlahTransaksi} transaksi belum masuk Laba Rugi, jadi angka ini bisa tidak lengkap.`
                  : ""
              }`
            : aksi?.jenis === "buka-laba"
              ? "Pengesahan laba dihapus. Laba perlu disahkan lagi sebelum bisa dibagikan."
              : "Seluruh jatah bulan ini dihapus dari saldo alokasi. Laba tetap berstatus disahkan. Pembatalan tercatat di Log Aktivitas."
        }
        labelKonfirmasi={
          aksi?.jenis === "acc-laba" ? "Sahkan" : aksi?.jenis === "buka-laba" ? "Buka kembali" : "Batalkan"
        }
        loading={memproses}
        onKonfirmasi={jalankan}
        onBatal={() => setAksi(null)}
      />

      <Modal
        buka={saldoAwal !== null}
        judul={`Saldo awal ${saldoAwal?.kode.nama ?? ""}`}
        deskripsi="Saldo alokasi yang sudah ada sebelum sistem ini dipakai. Menjadi titik awal perhitungan saldo."
        onTutup={() => setSaldoAwal(null)}
      >
        {saldoAwal && (
          <form onSubmit={simpanSaldoAwal} className="space-y-4">
            <Field label="Saldo awal (Rp)" hint="Kosongkan atau isi 0 kalau mulai dari nol">
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={saldoAwal.nilai}
                onChange={(e) => setSaldoAwal({ ...saldoAwal, nilai: e.target.value })}
                placeholder="0"
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" varian="sekunder" onClick={() => setSaldoAwal(null)}>
                Batal
              </Button>
              <Button type="submit" loading={memproses}>
                Simpan
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
