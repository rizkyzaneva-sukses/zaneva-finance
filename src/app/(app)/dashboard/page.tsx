"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Boxes, Scale, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Badge, Card, EmptyState, PageHeader, Skeleton, INPUT_CLASS } from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CashFlowChart, type TitikBulan } from "@/components/cash-flow-chart";
import { cn, formatRupiah, formatTanggal, labelBank } from "@/lib/utils";

interface KartuRekening {
  id: string;
  nama: string;
  bank: string;
  saldo: number;
  tanggalTerakhir: string | null;
  perluCek: boolean;
  brandId: string | null;
}

interface RingkasBulan {
  dari: string;
  sampai: string;
  pendapatan: number;
  hpp: number;
  labaKotor: number;
  beban: number;
  labaBersih: number;
  hppBelumFinal: boolean;
}

interface BarisBrand {
  id: string;
  nama: string;
  kas: number;
  persediaan: number;
  labaKotorLalu: number;
  labaBersihLalu: number;
  hppBelumFinalLalu: boolean;
}

interface BarisBreakdown {
  kodeAkunId: string | null;
  kode: string;
  nama: string;
  jumlahTransaksi: number;
  masuk: number;
  keluar: number;
  net: number;
}

interface DataDashboard {
  kartuRekening: KartuRekening[];
  ringkasan: { totalMasuk: number; totalKeluar: number; net: number; jumlahTransaksi: number };
  perBulan: TitikBulan[];
  breakdown: BarisBreakdown[];
  belumBeres: number;
  menungguAcc: number;
  bulanan: {
    bulanLalu: RingkasBulan;
    bulanIni: RingkasBulan;
    persediaan: { dipakai: boolean; adaAwal: boolean; nilai: number; posisi: string | null };
  };
  perBrand: BarisBrand[] | null;
  rekeningTanpaBrand: number;
}

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function namaBulan(isoStr: string) {
  const [y, m] = isoStr.split("-").map(Number);
  return `${NAMA_BULAN[m - 1]} ${y}`;
}

function Rp({ n, tebal }: { n: number; tebal?: boolean }) {
  return (
    <span className={cn("tabular-nums", tebal && "font-semibold", n < 0 ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-50")}>
      {n < 0 ? `(${formatRupiah(-n)})` : formatRupiah(n)}
    </span>
  );
}

function StatTile({
  label,
  nilai,
  ikon: Ikon,
  nadaNet,
}: {
  label: string;
  nilai: string;
  ikon: typeof ArrowUpRight;
  nadaNet?: "positif" | "negatif";
}) {
  return (
    <Card className="p-4 sm:p-4">
      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
        <Ikon className="h-4 w-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div
        className={
          nadaNet === "negatif"
            ? "mt-2 text-xl font-semibold text-red-700 dark:text-red-400"
            : nadaNet === "positif"
              ? "mt-2 text-xl font-semibold text-green-700 dark:text-green-400"
              : "mt-2 text-xl font-semibold text-gray-900 dark:text-gray-50"
        }
      >
        {nilai}
      </div>
    </Card>
  );
}

function RingkasanLaba({ d, cakupanRekening }: { d: DataDashboard; cakupanRekening: boolean }) {
  const { bulanLalu, bulanIni, persediaan } = d.bulanan;
  const baris: { label: string; lalu: number; ini: number; tebal?: boolean }[] = [
    { label: "Pendapatan", lalu: bulanLalu.pendapatan, ini: bulanIni.pendapatan },
    { label: "HPP (pembelian + Selisih HPP)", lalu: bulanLalu.hpp, ini: bulanIni.hpp },
    { label: "Laba kotor", lalu: bulanLalu.labaKotor, ini: bulanIni.labaKotor, tebal: true },
    { label: "Beban", lalu: bulanLalu.beban, ini: bulanIni.beban },
    { label: "Laba bersih", lalu: bulanLalu.labaBersih, ini: bulanIni.labaBersih, tebal: true },
  ];
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">Ringkasan laba</h2>
        <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
          Dari mesin Laporan yang sama, jadi angkanya sama dengan halaman Laporan. Tidak terpengaruh filter tanggal di atas.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-right text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                <th className="px-2 py-2 text-left font-medium"></th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">{namaBulan(bulanLalu.dari)}</th>
                <th className="whitespace-nowrap px-2 py-2 font-medium">{namaBulan(bulanIni.dari)} (berjalan)</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={b.label} className="border-b border-gray-100 dark:border-zinc-800">
                  <td className={cn("px-2 py-1.5 text-gray-900 dark:text-gray-50", b.tebal && "font-semibold")}>{b.label}</td>
                  <td className="px-2 py-1.5 text-right"><Rp n={b.lalu} tebal={b.tebal} /></td>
                  <td className="px-2 py-1.5 text-right"><Rp n={b.ini} tebal={b.tebal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {bulanIni.hppBelumFinal && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Bulan berjalan belum memuat Selisih HPP: SO akhir bulan baru ada setelah tanggal 1 bulan depan, jadi laba bulan ini belum final.
          </p>
        )}
        {bulanLalu.hppBelumFinal && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            SO akhir {namaBulan(bulanLalu.dari)} belum diunggah, jadi Selisih HPP bulan itu belum masuk.{" "}
            <Link href="/stok" className="font-medium underline">Stok &amp; HPP</Link>
          </p>
        )}
      </Card>

      <StatTile
        label={
          !persediaan.dipakai
            ? "Persediaan (tidak tersedia per rekening)"
            : persediaan.adaAwal && persediaan.posisi
              ? `Persediaan (SO per ${persediaan.posisi.split("-").reverse().join("/")})`
              : "Persediaan"
        }
        nilai={persediaan.dipakai && persediaan.adaAwal ? formatRupiah(persediaan.nilai) : "—"}
        ikon={Boxes}
      />
      {!persediaan.adaAwal && persediaan.dipakai && !cakupanRekening && (
        <p className="text-xs text-gray-600 dark:text-gray-400 lg:col-start-3">
          Belum ada Persediaan Awal.{" "}
          <Link href="/stok" className="font-medium underline">Unggah di Stok &amp; HPP</Link>
        </p>
      )}
    </div>
  );
}

function PerbandinganBrand({
  baris,
  tanpaBrand,
  pilih,
}: {
  baris: BarisBrand[];
  tanpaBrand: number;
  pilih: (id: string) => void;
}) {
  const jumlah = (f: (b: BarisBrand) => number) => baris.reduce((s, b) => s + f(b), 0);
  return (
    <Card>
      <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">Perbandingan antar brand</h2>
      <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
        Klik nama brand untuk melihat dashboard brand itu. Laba memakai bulan lalu (sudah final kalau SO-nya ada).
      </p>
      {tanpaBrand > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {tanpaBrand} rekening aktif belum diberi brand, jadi tidak termasuk di tabel ini.{" "}
            <Link href="/master/rekening" className="font-medium underline">Atur di Rekening</Link>
          </span>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-right text-gray-600 dark:border-zinc-700 dark:text-gray-400">
              <th className="px-2 py-2 text-left font-medium">Brand</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Kas</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Persediaan</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Laba kotor bln lalu</th>
              <th className="whitespace-nowrap px-2 py-2 font-medium">Laba bersih bln lalu</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.id} className="border-b border-gray-100 dark:border-zinc-800">
                <td className="px-2 py-1.5">
                  <button type="button" onClick={() => pilih(b.id)} className="font-medium text-blue-700 underline-offset-2 hover:underline dark:text-blue-300">
                    {b.nama}
                  </button>
                  {b.hppBelumFinalLalu && (
                    <span title="SO akhir bulan lalu belum diunggah" className="ml-1.5">
                      <Badge warna="kuning">HPP belum final</Badge>
                    </span>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right"><Rp n={b.kas} /></td>
                <td className="px-2 py-1.5 text-right"><Rp n={b.persediaan} /></td>
                <td className="px-2 py-1.5 text-right"><Rp n={b.labaKotorLalu} /></td>
                <td className="px-2 py-1.5 text-right"><Rp n={b.labaBersihLalu} /></td>
              </tr>
            ))}
            <tr className="border-t-2 border-gray-300 dark:border-zinc-600">
              <td className="px-2 py-1.5 font-semibold text-gray-900 dark:text-gray-50">Total brand</td>
              <td className="px-2 py-1.5 text-right"><Rp n={jumlah((b) => b.kas)} tebal /></td>
              <td className="px-2 py-1.5 text-right"><Rp n={jumlah((b) => b.persediaan)} tebal /></td>
              <td className="px-2 py-1.5 text-right"><Rp n={jumlah((b) => b.labaKotorLalu)} tebal /></td>
              <td className="px-2 py-1.5 text-right"><Rp n={jumlah((b) => b.labaBersihLalu)} tebal /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = React.useState<DataDashboard | null>(null);
  const [memuat, setMemuat] = React.useState(true);
  const [rekeningId, setRekeningId] = React.useState<string | null>(null);
  const [brandId, setBrandId] = React.useState<string | null>(null);
  const [daftarBrand, setDaftarBrand] = React.useState<{ id: string; nama: string }[]>([]);
  const [dari, setDari] = React.useState("");
  const [sampai, setSampai] = React.useState("");

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const q = new URLSearchParams();
      if (rekeningId) q.set("rekeningId", rekeningId);
      else if (brandId) q.set("brandId", brandId);
      if (dari) q.set("dari", dari);
      if (sampai) q.set("sampai", sampai);
      const res = await fetch(`/api/dashboard?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat dashboard");
    } finally {
      setMemuat(false);
    }
  }, [rekeningId, brandId, dari, sampai]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  React.useEffect(() => {
    fetch("/api/brand")
      .then((r) => (r.ok ? r.json() : { brand: [] }))
      .then((d) => setDaftarBrand(d.brand))
      .catch(() => {});
  }, []);

  const opsiRekening = React.useMemo(
    () => (data?.kartuRekening ?? []).map((r) => ({ value: r.id, label: r.nama, hint: labelBank(r.bank) })),
    [data]
  );

  // Skala bar dari net terbesar, bukan dari jumlah semua — net bisa positif & negatif
  const netTerbesar = Math.max(1, ...(data?.breakdown ?? []).map((b) => Math.abs(b.net)));

  return (
    <>
      <PageHeader
        judul="Dashboard"
        deskripsi={
          brandId
            ? `Brand ${daftarBrand.find((b) => b.id === brandId)?.nama ?? ""}: rekening milik brand ini.`
            : "Ringkasan cash flow dan saldo seluruh rekening."
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-48">
          <SearchableSelect
            label="Brand"
            value={brandId}
            onChange={(v) => {
              setBrandId(v);
              setRekeningId(null);
            }}
            options={daftarBrand.map((b) => ({ value: b.id, label: b.nama }))}
            placeholder="Semua brand"
            emptyText="Belum ada brand"
          />
        </div>
        <div className="w-56">
          <SearchableSelect
            label="Rekening"
            value={rekeningId}
            onChange={setRekeningId}
            options={opsiRekening}
            placeholder="Semua rekening"
            emptyText="Belum ada rekening"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Dari
          </label>
          <input type="date" value={dari} onChange={(e) => setDari(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Sampai
          </label>
          <input
            type="date"
            value={sampai}
            onChange={(e) => setSampai(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
      </div>

      {memuat ? (
        <Skeleton baris={8} />
      ) : !data ? (
        <Card>
          <EmptyState pesan="Data tidak bisa dimuat." />
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label="Uang masuk"
              nilai={formatRupiah(data.ringkasan.totalMasuk)}
              ikon={ArrowDownLeft}
            />
            <StatTile
              label="Uang keluar"
              nilai={formatRupiah(data.ringkasan.totalKeluar)}
              ikon={ArrowUpRight}
            />
            <StatTile
              label="Net"
              nilai={formatRupiah(data.ringkasan.net)}
              ikon={Scale}
              nadaNet={data.ringkasan.net < 0 ? "negatif" : "positif"}
            />
            <StatTile
              label="Jumlah transaksi"
              nilai={String(data.ringkasan.jumlahTransaksi)}
              ikon={ListChecks}
            />
          </div>

          {data.menungguAcc > 0 && (
            <Link
              href="/transaksi?menungguAcc=1"
              className="flex items-center gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 transition-colors hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
            >
              <ListChecks className="h-4 w-4 shrink-0" />
              <span>
                <strong>{data.menungguAcc} transaksi menunggu ACC</strong> — hasil kerja STAFF atau
                Bendahara yang belum disahkan. Transaksinya tetap dihitung di laporan.
              </span>
            </Link>
          )}

          {data.belumBeres > 0 && (
            <Link
              href="/transaksi?belumBeres=1"
              className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{data.belumBeres} transaksi belum beres</strong> — kode akun masih kosong,
                masih berupa saran AI yang belum dikonfirmasi, atau ditandai tidak yakin.
              </span>
            </Link>
          )}

          <RingkasanLaba d={data} cakupanRekening={rekeningId !== null} />

          {data.perBrand && data.perBrand.length > 0 && (
            <PerbandinganBrand
              baris={data.perBrand}
              tanpaBrand={data.rekeningTanpaBrand}
              pilih={(id) => {
                setBrandId(id);
                setRekeningId(null);
              }}
            />
          )}

          <div>
            <h2 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
              Saldo per rekening
            </h2>
            {data.kartuRekening.length === 0 ? (
              <Card>
                <EmptyState pesan="Belum ada rekening aktif." />
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.kartuRekening.map((r) => (
                  <Card key={r.id} className="p-4 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-gray-900 dark:text-gray-50">
                          {r.nama}
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">{labelBank(r.bank)}</div>
                      </div>
                      {r.perluCek && (
                        <span title="Saldo hitungan sistem beda dengan saldo di mutasi bank">
                          <Badge warna="kuning">Perlu dicek</Badge>
                        </span>
                      )}
                    </div>
                    <div className="mt-3 text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-50">
                      {formatRupiah(r.saldo)}
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      {r.tanggalTerakhir
                        ? `Transaksi terakhir ${formatTanggal(r.tanggalTerakhir)}`
                        : "Belum ada transaksi"}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
              Cash flow per bulan
            </h2>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Uang masuk dibanding uang keluar. Arahkan kursor ke batang untuk nilai persisnya.
            </p>
            {data.perBulan.length === 0 ? (
              <EmptyState pesan="Belum ada transaksi pada rentang ini." />
            ) : (
              <CashFlowChart data={data.perBulan} />
            )}
          </Card>

          <Card>
            <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-50">
              Breakdown per kode akun
            </h2>
            <p className="mb-3 text-xs text-gray-600 dark:text-gray-400">
              Kolom Net adalah uang masuk dikurangi uang keluar, diurutkan dari yang terbesar
              pengaruhnya. Akun dua arah seperti transfer antar rekening akan mendekati nol.
            </p>
            {data.breakdown.length === 0 ? (
              <EmptyState pesan="Belum ada transaksi pada rentang ini." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                      <th className="whitespace-nowrap px-2 py-2 font-medium">Kode</th>
                      <th className="px-2 py-2 font-medium">Nama</th>
                      <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Masuk</th>
                      <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Keluar</th>
                      <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Net</th>
                      <th className="w-32 px-2 py-2"></th>
                      <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Transaksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.breakdown.map((b) => (
                      <tr
                        key={b.kodeAkunId ?? "tanpa-kode"}
                        className="border-b border-gray-100 dark:border-zinc-800"
                      >
                        <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-gray-900 dark:text-gray-50">
                          {b.kode}
                        </td>
                        <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{b.nama}</td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                          {b.masuk ? formatRupiah(b.masuk) : "—"}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                          {b.keluar ? formatRupiah(b.keluar) : "—"}
                        </td>
                        <td
                          className={cn(
                            "whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums",
                            b.net < 0
                              ? "text-red-700 dark:text-red-400"
                              : "text-gray-900 dark:text-gray-50"
                          )}
                        >
                          {b.net < 0 ? `(${formatRupiah(-b.net)})` : formatRupiah(b.net)}
                        </td>
                        <td className="px-2 py-2">
                          <div
                            className="h-2 rounded-sm"
                            style={{
                              width: `${Math.max(2, (Math.abs(b.net) / netTerbesar) * 100)}%`,
                              background: b.net >= 0 ? "var(--chart-masuk)" : "var(--chart-keluar)",
                            }}
                          />
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-600 dark:text-gray-400">
                          {b.jumlahTransaksi}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
