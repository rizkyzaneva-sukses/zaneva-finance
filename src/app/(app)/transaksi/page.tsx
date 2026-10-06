"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Download, Trash2, AlertTriangle, Search, Scissors } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  INPUT_CLASS,
  PageHeader,
  Skeleton,
} from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { SplitEditor, type RincianForm } from "@/components/split-editor";
import { cn, formatAngka, formatTanggal } from "@/lib/utils";

interface Transaksi {
  id: string;
  tanggal: string;
  keterangan: string;
  uangMasuk: string;
  uangKeluar: string;
  saldo: string;
  saldoBank: string | null;
  catatan: string | null;
  statusKode: "KOSONG" | "SARAN_AI" | "DIKONFIRMASI";
  yakin: boolean;
  rekening: { id: string; nama: string };
  kodeAkun: { id: string; kode: string; nama: string } | null;
  rincian: {
    id: string;
    nominal: string;
    keterangan: string | null;
    kodeAkun: { id: string; kode: string; nama: string };
  }[];
  createdBy: { nama: string } | null;
  updatedBy: { nama: string } | null;
}

function TransaksiIsi() {
  const params = useSearchParams();

  const [daftar, setDaftar] = React.useState<Transaksi[]>([]);
  const [total, setTotal] = React.useState(0);
  const [halaman, setHalaman] = React.useState(1);
  const [memuat, setMemuat] = React.useState(true);

  const [rekening, setRekening] = React.useState<SelectOption[]>([]);
  const [kodeAkun, setKodeAkun] = React.useState<{ id: string; kode: string; nama: string }[]>([]);

  const [filterRekening, setFilterRekening] = React.useState<string | null>(null);
  const [filterKode, setFilterKode] = React.useState<string | null>(null);
  const [dari, setDari] = React.useState("");
  const [sampai, setSampai] = React.useState("");
  const [cari, setCari] = React.useState("");
  const [belumBeres, setBelumBeres] = React.useState(params.get("belumBeres") === "1");

  const [hapusTarget, setHapusTarget] = React.useState<Transaksi | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);
  const [splitTarget, setSplitTarget] = React.useState<Transaksi | null>(null);
  const [menyimpanSplit, setMenyimpanSplit] = React.useState(false);

  const perHalaman = 50;

  const query = React.useCallback(() => {
    const q = new URLSearchParams();
    if (filterRekening) q.set("rekeningId", filterRekening);
    if (filterKode) q.set("kodeAkunId", filterKode);
    if (dari) q.set("dari", dari);
    if (sampai) q.set("sampai", sampai);
    if (cari) q.set("cari", cari);
    if (belumBeres) q.set("belumBeres", "1");
    return q;
  }, [filterRekening, filterKode, dari, sampai, cari, belumBeres]);

  const muat = React.useCallback(async () => {
    setMemuat(true);
    try {
      const q = query();
      q.set("halaman", String(halaman));
      q.set("perHalaman", String(perHalaman));
      const res = await fetch(`/api/transaksi?${q}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar(data.transaksi);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat transaksi");
    } finally {
      setMemuat(false);
    }
  }, [query, halaman]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  React.useEffect(() => {
    (async () => {
      const [r1, r2] = await Promise.all([fetch("/api/rekening"), fetch("/api/kode-akun?aktif=1")]);
      const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
      if (r1.ok)
        setRekening(d1.rekening.map((r: { id: string; nama: string; bank: string }) => ({
          value: r.id,
          label: r.nama,
          hint: r.bank,
        })));
      if (r2.ok) setKodeAkun(d2.kodeAkun);
    })();
  }, []);

  const opsiKode: SelectOption[] = React.useMemo(
    () => kodeAkun.map((k) => ({ value: k.id, label: `${k.kode} — ${k.nama}`, hint: k.kode })),
    [kodeAkun]
  );

  async function ubah(id: string, patch: { kodeAkunId?: string | null; catatan?: string }) {
    try {
      const res = await fetch(`/api/transaksi/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDaftar((prev) =>
        prev.map((t) =>
          t.id === id
            ? {
                ...t,
                kodeAkun: data.transaksi.kodeAkun,
                catatan: data.transaksi.catatan,
                statusKode: data.transaksi.statusKode,
              }
            : t
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
      muat();
    }
  }

  async function simpanSplit(rincian: RincianForm[]) {
    if (!splitTarget) return;
    setMenyimpanSplit(true);
    try {
      const res = await fetch(`/api/transaksi/${splitTarget.id}/rincian`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rincian }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(rincian.length > 0 ? "Split tersimpan" : "Split dibatalkan");
      setSplitTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan split");
    } finally {
      setMenyimpanSplit(false);
    }
  }

  async function hapus() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/transaksi/${hapusTarget.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      toast.success("Transaksi dihapus, saldo dihitung ulang");
      setHapusTarget(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setMenghapus(false);
    }
  }

  function exportExcel() {
    if (total === 0) {
      toast.error("Tidak ada transaksi untuk diexport");
      return;
    }
    window.location.href = `/api/export/rekap?${query()}`;
  }

  const totalHalaman = Math.max(1, Math.ceil(total / perHalaman));

  return (
    <>
      <PageHeader
        judul="Transaksi"
        deskripsi="Seluruh rekap yang tersimpan. Kode akun dan catatan bisa dikoreksi langsung di tabel."
        aksi={
          <Button varian="sekunder" onClick={exportExcel}>
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        }
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SearchableSelect
            label="Rekening"
            value={filterRekening}
            onChange={(v) => {
              setFilterRekening(v);
              setHalaman(1);
            }}
            options={rekening}
            placeholder="Semua rekening"
          />
          <SearchableSelect
            label="Kode akun"
            value={filterKode}
            onChange={(v) => {
              setFilterKode(v);
              setHalaman(1);
            }}
            options={opsiKode}
            placeholder="Semua kode"
            searchPlaceholder="Cari kode..."
          />
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Dari
            </label>
            <input
              type="date"
              value={dari}
              onChange={(e) => {
                setDari(e.target.value);
                setHalaman(1);
              }}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Sampai
            </label>
            <input
              type="date"
              value={sampai}
              onChange={(e) => {
                setSampai(e.target.value);
                setHalaman(1);
              }}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Cari keterangan
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
              <input
                value={cari}
                onChange={(e) => {
                  setCari(e.target.value);
                  setHalaman(1);
                }}
                placeholder="misal: MIDTRANS"
                className={`${INPUT_CLASS} pl-8`}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={belumBeres}
              onChange={(e) => {
                setBelumBeres(e.target.checked);
                setHalaman(1);
              }}
              className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
            />
            Hanya yang belum beres
          </label>
        </div>
      </Card>

      <Card>
        {memuat ? (
          <Skeleton baris={8} />
        ) : daftar.length === 0 ? (
          <EmptyState pesan="Belum ada transaksi yang cocok dengan filter ini." />
        ) : (
          <>
            <div className="mb-2 text-xs text-gray-600 dark:text-gray-400">
              {total} transaksi · halaman {halaman} dari {totalHalaman}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Tanggal</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Rekening</th>
                    <th className="min-w-52 px-2 py-2 font-medium">Keterangan</th>
                    <th className="min-w-52 px-2 py-2 font-medium">Kode akun</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Masuk</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Keluar</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo</th>
                    <th className="min-w-36 px-2 py-2 font-medium">Catatan</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((t) => (
                    <React.Fragment key={t.id}>
                    <tr className="border-b border-gray-100 align-top dark:border-zinc-800">
                      <td className="whitespace-nowrap px-2 py-2 text-gray-900 dark:text-gray-50">
                        {formatTanggal(t.tanggal)}
                        {!t.yakin && (
                          <span
                            title="AI tidak yakin membaca baris ini"
                            className="ml-1 inline-flex text-amber-600 dark:text-amber-400"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-400">
                        {t.rekening.nama}
                      </td>
                      <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{t.keterangan}</td>
                      <td className="px-2 py-2">
                        {t.rincian.length > 0 ? (
                          <Badge warna="biru">
                            <Scissors className="mr-1 inline h-3 w-3" />
                            Di-split ({t.rincian.length} rincian)
                          </Badge>
                        ) : (
                          <>
                            <SearchableSelect
                              compact
                              value={t.kodeAkun?.id ?? null}
                              onChange={(v) => ubah(t.id, { kodeAkunId: v })}
                              options={opsiKode}
                              placeholder="Pilih kode"
                              searchPlaceholder="Cari kode..."
                            />
                            {t.statusKode === "SARAN_AI" && (
                              <span className="mt-1 inline-block text-xs text-blue-700 dark:text-blue-300">
                                saran AI — belum dikonfirmasi
                              </span>
                            )}
                          </>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                        {Number(t.uangMasuk) ? formatAngka(t.uangMasuk) : ""}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                        {Number(t.uangKeluar) ? formatAngka(t.uangKeluar) : ""}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                        {formatAngka(t.saldo)}
                        {t.saldoBank !== null &&
                          Math.abs(Number(t.saldo) - Number(t.saldoBank)) >= 1 && (
                            <div
                              title={`Saldo di mutasi bank: ${formatAngka(t.saldoBank)}`}
                              className="mt-0.5"
                            >
                              <Badge warna="kuning">beda dgn bank</Badge>
                            </div>
                          )}
                      </td>
                      <td className="px-2 py-2">
                        <input
                          defaultValue={t.catatan ?? ""}
                          onBlur={(e) => {
                            if (e.target.value !== (t.catatan ?? "")) {
                              ubah(t.id, { catatan: e.target.value });
                            }
                          }}
                          placeholder="—"
                          className={`${INPUT_CLASS} py-1 text-xs`}
                        />
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        <button
                          type="button"
                          title={t.rincian.length > 0 ? "Ubah split" : "Split transaksi ini"}
                          aria-label={t.rincian.length > 0 ? "Ubah split" : "Split transaksi ini"}
                          onClick={() => setSplitTarget(t)}
                          className={cn(
                            "rounded p-1.5 hover:bg-gray-100 dark:hover:bg-zinc-700",
                            t.rincian.length > 0
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-500 dark:text-gray-400"
                          )}
                        >
                          <Scissors className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Hapus transaksi"
                          onClick={() => setHapusTarget(t)}
                          className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                    {t.rincian.map((r) => {
                      const masuk = Number(t.uangMasuk) > 0;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/40"
                        >
                          <td colSpan={2}></td>
                          <td className="px-2 py-1.5 pl-6 text-xs text-gray-600 dark:text-gray-400">
                            ↳ {r.keterangan || r.kodeAkun.nama}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-gray-900 dark:text-gray-50">
                            <span className="font-mono">{r.kodeAkun.kode}</span> — {r.kodeAkun.nama}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 dark:text-gray-50">
                            {masuk ? formatAngka(r.nominal) : ""}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 dark:text-gray-50">
                            {masuk ? "" : formatAngka(r.nominal)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      );
                    })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {totalHalaman > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <Button
                  varian="sekunder"
                  disabled={halaman <= 1}
                  onClick={() => setHalaman((h) => h - 1)}
                >
                  Sebelumnya
                </Button>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {halaman} / {totalHalaman}
                </span>
                <Button
                  varian="sekunder"
                  disabled={halaman >= totalHalaman}
                  onClick={() => setHalaman((h) => h + 1)}
                >
                  Berikutnya
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {splitTarget && (
        <SplitEditor
          total={Number(splitTarget.uangMasuk) || Number(splitTarget.uangKeluar)}
          arah={Number(splitTarget.uangMasuk) > 0 ? "masuk" : "keluar"}
          keteranganAsli={splitTarget.keterangan}
          opsiKode={opsiKode}
          awal={splitTarget.rincian.map((r) => ({
            kodeAkunId: r.kodeAkun.id,
            nominal: String(Number(r.nominal)),
            keterangan: r.keterangan ?? "",
          }))}
          bolehBatalkan={splitTarget.rincian.length > 0}
          menyimpan={menyimpanSplit}
          onTutup={() => setSplitTarget(null)}
          onSimpan={simpanSplit}
          onBatalkanSplit={() => simpanSplit([])}
        />
      )}

      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus transaksi?"
        pesan={`"${hapusTarget?.keterangan}" akan dihapus permanen dan saldo berjalan rekening dihitung ulang. Tindakan ini tidak bisa dibatalkan.`}
        loading={menghapus}
        onKonfirmasi={hapus}
        onBatal={() => setHapusTarget(null)}
      />
    </>
  );
}

export default function TransaksiPage() {
  return (
    <React.Suspense fallback={<Skeleton baris={8} />}>
      <TransaksiIsi />
    </React.Suspense>
  );
}
