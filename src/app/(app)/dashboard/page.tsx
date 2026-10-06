"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Scale, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Badge, Card, EmptyState, PageHeader, Skeleton, INPUT_CLASS } from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CashFlowChart, type TitikBulan } from "@/components/cash-flow-chart";
import { cn, formatRupiah, formatTanggal } from "@/lib/utils";

interface KartuRekening {
  id: string;
  nama: string;
  bank: string;
  saldo: number;
  tanggalTerakhir: string | null;
  perluCek: boolean;
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

export default function DashboardPage() {
  const [data, setData] = React.useState<DataDashboard | null>(null);
  const [memuat, setMemuat] = React.useState(true);
  const [rekeningId, setRekeningId] = React.useState<string | null>(null);
  const [dari, setDari] = React.useState("");
  const [sampai, setSampai] = React.useState("");

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const q = new URLSearchParams();
      if (rekeningId) q.set("rekeningId", rekeningId);
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
  }, [rekeningId, dari, sampai]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  const opsiRekening = React.useMemo(
    () => (data?.kartuRekening ?? []).map((r) => ({ value: r.id, label: r.nama, hint: r.bank })),
    [data]
  );

  // Skala bar dari net terbesar, bukan dari jumlah semua — net bisa positif & negatif
  const netTerbesar = Math.max(1, ...(data?.breakdown ?? []).map((b) => Math.abs(b.net)));

  return (
    <>
      <PageHeader judul="Dashboard" deskripsi="Ringkasan cash flow dan saldo seluruh rekening." />

      <div className="mb-4 flex flex-wrap items-end gap-3">
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
                        <div className="text-xs text-gray-600 dark:text-gray-400">{r.bank}</div>
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
