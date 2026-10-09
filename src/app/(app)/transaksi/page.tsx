"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Download,
  Trash2,
  AlertTriangle,
  Search,
  Scissors,
  Plus,
  Check,
  CheckCheck,
  Clock,
} from "lucide-react";
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
  TabButton,
  TabList,
} from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { SplitEditor, type RincianForm } from "@/components/split-editor";
import { cn, formatAngka, formatTanggal, labelBank } from "@/lib/utils";

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
  statusAcc: "DISETUJUI" | "MENUNGGU" | "PERLU_FINANCE";
  accOleh: { nama: string } | null;
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
  diverifikasiPada: string | null;
  diverifikasiOleh: { nama: string } | null;
}

interface FormManual {
  rekeningId: string | null;
  tanggalIso: string;
  keterangan: string;
  arah: "masuk" | "keluar";
  nominal: string;
  kodeAkunId: string | null;
  catatan: string;
}

/** Tanggal lokal (WIB), bukan toISOString yang UTC — sebelum jam 07.00 WIB itu masih "kemarin". */
const hariIniIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function penjualan400(t: Pick<Transaksi, "kodeAkun" | "rincian">): boolean {
  return t.kodeAkun?.kode === "400" || t.rincian.some((r) => r.kodeAkun.kode === "400");
}

function TransaksiIsi() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = params.get("tab") === "penjualan" ? "penjualan" : "riwayat";

  const [daftar, setDaftar] = React.useState<Transaksi[]>([]);
  const [total, setTotal] = React.useState(0);
  const [halaman, setHalaman] = React.useState(1);
  const [memuat, setMemuat] = React.useState(true);

  const [rekening, setRekening] = React.useState<SelectOption[]>([]);
  const [kodeAkun, setKodeAkun] = React.useState<{ id: string; kode: string; nama: string }[]>([]);

  const [filterRekening, setFilterRekening] = React.useState<string | null>(null);
  const [filterKode, setFilterKode] = React.useState<string | null>(params.get("kodeAkunId"));
  const [dari, setDari] = React.useState("");
  const [sampai, setSampai] = React.useState("");
  const [cari, setCari] = React.useState("");
  const [belumBeres, setBelumBeres] = React.useState(params.get("belumBeres") === "1");
  const [menungguAcc, setMenungguAcc] = React.useState(params.get("menungguAcc") === "1");
  const [verifikasi, setVerifikasi] = React.useState<string | null>(null);

  const [role, setRole] = React.useState<string | null>(null);
  const [menyetujui, setMenyetujui] = React.useState(false);
  const [formManual, setFormManual] = React.useState<FormManual | null>(null);
  const [menyimpanManual, setMenyimpanManual] = React.useState(false);

  // ACC berjenjang: Bendahara memverifikasi input staff (MENUNGGU);
  // Finance (ADMIN/OWNER) memfinalkan koreksi kode/catatan/split (PERLU_FINANCE).
  const bisaAccBendahara = role === "ADMIN" || role === "OWNER" || role === "BENDAHARA";
  const bisaAccFinance = role === "ADMIN" || role === "OWNER";
  const bolehHapus = role === "ADMIN" || role === "OWNER";
  const bolehExport = role !== null && role !== "BENDAHARA";
  const bolehVerifikasi = role === "STAFF" || role === "ADMIN" || role === "OWNER";
  const [memverifikasi, setMemverifikasi] = React.useState(false);

  const [hapusTarget, setHapusTarget] = React.useState<Transaksi | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);
  const [splitTarget, setSplitTarget] = React.useState<Transaksi | null>(null);
  const [menyimpanSplit, setMenyimpanSplit] = React.useState(false);

  const perHalaman = 50;

  const query = React.useCallback(() => {
    const q = new URLSearchParams();
    if (filterRekening) q.set("rekeningId", filterRekening);
    if (filterKode && tab !== "penjualan") q.set("kodeAkunId", filterKode);
    if (dari) q.set("dari", dari);
    if (sampai) q.set("sampai", sampai);
    if (cari) q.set("cari", cari);
    if (belumBeres) q.set("belumBeres", "1");
    if (menungguAcc) q.set("menungguAcc", "1");
    if (tab === "penjualan") {
      q.set("penjualan", "1");
      if (verifikasi) q.set("verifikasi", verifikasi);
    }
    return q;
  }, [filterRekening, filterKode, dari, sampai, cari, belumBeres, menungguAcc, tab, verifikasi]);

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
      const [r1, r2, r3] = await Promise.all([
        fetch("/api/rekening"),
        fetch("/api/kode-akun?aktif=1"),
        fetch("/api/auth/me"),
      ]);
      const [d1, d2, d3] = await Promise.all([r1.json(), r2.json(), r3.json()]);
      if (r1.ok)
        setRekening(
          d1.rekening
            .filter((r: { aktif: boolean }) => r.aktif)
            .map((r: { id: string; nama: string; bank: string }) => ({
              value: r.id,
              label: r.nama,
              hint: labelBank(r.bank),
            }))
        );
      if (r2.ok) setKodeAkun(d2.kodeAkun);
      if (r3.ok) setRole(d3.user.role);
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
                statusAcc: data.transaksi.statusAcc,
                accOleh: null,
                diverifikasiPada: data.transaksi.diverifikasiPada ?? null,
                diverifikasiOleh: data.transaksi.diverifikasiOleh ?? null,
              }
            : t
        )
      );
      if (data.transaksi.statusAcc === "PERLU_FINANCE") {
        toast.info("Perubahan tersimpan, menunggu ACC Finance");
      } else if (data.transaksi.statusAcc === "MENUNGGU") {
        toast.info("Perubahan tersimpan, menunggu ACC Bendahara");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan perubahan");
      muat();
    }
  }

  function gantiTab(berikut: "riwayat" | "penjualan") {
    const q = new URLSearchParams(params.toString());
    if (berikut === "penjualan") q.set("tab", "penjualan");
    else q.delete("tab");
    setVerifikasi(null);
    setHalaman(1);
    const s = q.toString();
    router.replace(s ? `${pathname}?${s}` : pathname);
  }

  async function tandaiVerifikasi(ids: string[], verified: boolean) {
    if (ids.length === 0) return;
    setMemverifikasi(true);
    try {
      const res = await fetch("/api/transaksi/verifikasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, verified }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(verified ? `${data.diubah} penjualan ditandai Verified` : `${data.diubah} verifikasi dikosongkan`);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengubah verifikasi");
    } finally {
      setMemverifikasi(false);
    }
  }

  async function setujui(ids: string[], tahap?: "bendahara" | "finance") {
    if (ids.length === 0) return;
    setMenyetujui(true);
    try {
      const res = await fetch("/api/transaksi/acc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tahap ? { ids, tahap } : { ids }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.disahkan === 0 && data.ditolak > 0) {
        toast.error("Tidak punya wewenang menyetujui transaksi ini");
      } else {
        toast.success(
          `${data.disahkan} transaksi disahkan` +
            (data.ditolak > 0 ? ` (${data.ditolak} perlu wewenang Finance)` : "")
        );
      }
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengesahkan");
    } finally {
      setMenyetujui(false);
    }
  }

  async function simpanManual(e: React.FormEvent) {
    e.preventDefault();
    if (!formManual) return;
    if (!formManual.rekeningId) {
      toast.error("Pilih rekening dulu");
      return;
    }
    const nominal = Number(formManual.nominal);
    if (!Number.isFinite(nominal) || nominal <= 0) {
      toast.error("Nominal harus lebih dari 0");
      return;
    }
    setMenyimpanManual(true);
    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rekeningId: formManual.rekeningId,
          tanggalIso: formManual.tanggalIso,
          keterangan: formManual.keterangan,
          uangMasuk: formManual.arah === "masuk" ? nominal : 0,
          uangKeluar: formManual.arah === "keluar" ? nominal : 0,
          kodeAkunId: formManual.kodeAkunId,
          catatan: formManual.catatan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        data.transaksi.statusAcc === "MENUNGGU"
          ? "Transaksi tersimpan, menunggu ACC Bendahara"
          : "Transaksi tersimpan"
      );
      setFormManual(null);
      muat();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan transaksi");
    } finally {
      setMenyimpanManual(false);
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
        deskripsi={
          tab === "penjualan"
            ? "Penjualan kode 400. Staff dan Finance bisa menandai Verified setelah dicek. Kosong berarti belum."
            : "Seluruh rekap yang tersimpan. Kode akun dan catatan bisa dikoreksi langsung di tabel."
        }
        aksi={
          <>
            <Button
              onClick={() =>
                setFormManual({
                  rekeningId: rekening.length === 1 ? rekening[0].value : null,
                  tanggalIso: hariIniIso(),
                  keterangan: "",
                  arah: "keluar",
                  nominal: "",
                  kodeAkunId: null,
                  catatan: "",
                })
              }
            >
              <Plus className="h-4 w-4" />
              Tambah Transaksi
            </Button>
            {bolehExport && (
              <Button varian="sekunder" onClick={exportExcel}>
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
            )}
          </>
        }
      />

      <TabList label="Bagian transaksi" className="mb-4 max-w-md">
        <TabButton aktif={tab === "riwayat"} onClick={() => gantiTab("riwayat")}>
          History
        </TabButton>
        <TabButton aktif={tab === "penjualan"} onClick={() => gantiTab("penjualan")}>
          Penjualan
        </TabButton>
      </TabList>

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
          {tab === "penjualan" ? (
            <SearchableSelect
              label="Verifikasi"
              value={verifikasi}
              onChange={(v) => {
                setVerifikasi(v);
                setHalaman(1);
              }}
              options={[
                { value: "belum", label: "Belum" },
                { value: "sudah", label: "Verified" },
              ]}
              placeholder="Semua"
              searchPlaceholder="Cari status..."
            />
          ) : (
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
          )}
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
          <label className="flex items-center gap-2 pb-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={menungguAcc}
              onChange={(e) => {
                setMenungguAcc(e.target.checked);
                setHalaman(1);
              }}
              className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
            />
            Hanya yang menunggu ACC
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
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {total} transaksi · halaman {halaman} dari {totalHalaman}
              </span>
              <div className="flex flex-wrap gap-2">
                {bisaAccBendahara && daftar.some((t) => t.statusAcc === "MENUNGGU") && (
                  <Button
                    varian="sekunder"
                    loading={menyetujui}
                    onClick={() =>
                      setujui(daftar.filter((t) => t.statusAcc === "MENUNGGU").map((t) => t.id), "bendahara")
                    }
                  >
                    <CheckCheck className="h-4 w-4" />
                    Verifikasi {daftar.filter((t) => t.statusAcc === "MENUNGGU").length} (Bendahara)
                  </Button>
                )}
                {bisaAccFinance && daftar.some((t) => t.statusAcc === "PERLU_FINANCE") && (
                  <Button
                    varian="sekunder"
                    loading={menyetujui}
                    onClick={() =>
                      setujui(daftar.filter((t) => t.statusAcc === "PERLU_FINANCE").map((t) => t.id), "finance")
                    }
                  >
                    <CheckCheck className="h-4 w-4" />
                    Finalkan {daftar.filter((t) => t.statusAcc === "PERLU_FINANCE").length} (Finance)
                  </Button>
                )}
                {tab === "penjualan" && bolehVerifikasi && daftar.some((t) => !t.diverifikasiPada) && (
                  <Button
                    varian="sekunder"
                    loading={memverifikasi}
                    onClick={() =>
                      tandaiVerifikasi(
                        daftar.filter((t) => !t.diverifikasiPada).map((t) => t.id),
                        true
                      )
                    }
                  >
                    <CheckCheck className="h-4 w-4" />
                    Verifikasi yang belum ({daftar.filter((t) => !t.diverifikasiPada).length})
                  </Button>
                )}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Tanggal</th>
                    <th className="min-w-52 px-2 py-2 font-medium">Kode akun</th>
                    <th className="whitespace-nowrap px-2 py-2 font-medium">Rekening</th>
                    <th className="min-w-52 px-2 py-2 font-medium">Keterangan</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Masuk</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Keluar</th>
                    <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Saldo</th>
                    <th className="min-w-36 px-2 py-2 font-medium">Catatan</th>
                    {tab === "penjualan" && (
                      <th className="whitespace-nowrap px-2 py-2 font-medium">Verifikasi</th>
                    )}
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {daftar.map((t) => (
                    <React.Fragment key={t.id}>
                    <tr
                      className={cn(
                        "border-b border-gray-100 align-top dark:border-zinc-800",
                        tab === "penjualan" &&
                          !t.diverifikasiPada &&
                          "bg-amber-50 dark:bg-amber-950/30",
                        tab === "penjualan" &&
                          t.diverifikasiPada &&
                          "bg-green-50 dark:bg-green-950/30"
                      )}
                    >
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
                        {t.statusAcc === "MENUNGGU" && (
                          <div
                            className="mt-1"
                            title={`Dibuat/diubah oleh ${t.updatedBy?.nama ?? t.createdBy?.nama ?? "-"}, menunggu verifikasi Bendahara`}
                          >
                            <Badge warna="biru">
                              <Clock className="mr-1 inline h-3 w-3" />
                              ACC Bendahara
                            </Badge>
                          </div>
                        )}
                        {t.statusAcc === "PERLU_FINANCE" && (
                          <div
                            className="mt-1"
                            title={`Dibuat/diubah oleh ${t.updatedBy?.nama ?? t.createdBy?.nama ?? "-"}, sudah diverifikasi Bendahara — menunggu finalisasi Finance`}
                          >
                            <Badge warna="kuning">
                              <Clock className="mr-1 inline h-3 w-3" />
                              Perlu ACC Finance
                            </Badge>
                          </div>
                        )}
                      </td>
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
                              <span className="mt-1 inline-block text-xs text-blue-800 dark:text-blue-300">
                                saran AI — belum dikonfirmasi
                              </span>
                            )}
                          </>
                        )}
                        {tab !== "penjualan" && penjualan400(t) && t.diverifikasiPada && (
                          <div className="mt-1" title={t.diverifikasiOleh ? `Oleh ${t.diverifikasiOleh.nama}` : undefined}>
                            <Badge warna="hijau">Verified</Badge>
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-2 py-2 text-gray-600 dark:text-gray-400">
                        {t.rekening.nama}
                      </td>
                      <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{t.keterangan}</td>
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
                      {tab === "penjualan" && (
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            disabled={!bolehVerifikasi || memverifikasi}
                            onClick={() => tandaiVerifikasi([t.id], !t.diverifikasiPada)}
                            title={
                              t.diverifikasiPada
                                ? `Verified${t.diverifikasiOleh ? ` oleh ${t.diverifikasiOleh.nama}` : ""}. Klik untuk mengosongkan.`
                                : bolehVerifikasi
                                  ? "Belum diverifikasi. Klik untuk menandai Verified."
                                  : "Belum diverifikasi"
                            }
                            className="rounded disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {t.diverifikasiPada ? (
                              <Badge warna="hijau">Verified</Badge>
                            ) : (
                              <Badge warna="abu">Belum</Badge>
                            )}
                          </button>
                        </td>
                      )}
                      <td className="whitespace-nowrap px-2 py-2 text-right">
                        {t.statusAcc === "MENUNGGU" && bisaAccBendahara && (
                          <button
                            type="button"
                            title="Verifikasi (ACC Bendahara)"
                            aria-label="Verifikasi transaksi ini"
                            disabled={menyetujui}
                            onClick={() => setujui([t.id], "bendahara")}
                            className="rounded p-1.5 text-green-700 hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/30"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
                        {t.statusAcc === "PERLU_FINANCE" && bisaAccFinance && (
                          <button
                            type="button"
                            title="Finalkan (ACC Finance)"
                            aria-label="Finalisasi transaksi ini"
                            disabled={menyetujui}
                            onClick={() => setujui([t.id], "finance")}
                            className="rounded p-1.5 text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        )}
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
                        {bolehHapus && (
                          <button
                            type="button"
                            aria-label="Hapus transaksi"
                            onClick={() => setHapusTarget(t)}
                            className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-gray-400 dark:hover:bg-red-900/30 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                    {t.rincian.map((r) => {
                      const masuk = Number(t.uangMasuk) > 0;
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/40"
                        >
                          <td className="px-2 py-1.5"></td>
                          <td className="px-2 py-1.5 text-xs text-gray-900 dark:text-gray-50">
                            <span className="font-mono">{r.kodeAkun.kode}</span> — {r.kodeAkun.nama}
                          </td>
                          <td className="px-2 py-1.5"></td>
                          <td className="px-2 py-1.5 pl-6 text-xs text-gray-600 dark:text-gray-400">
                            ↳ {r.keterangan || r.kodeAkun.nama}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 dark:text-gray-50">
                            {masuk ? formatAngka(r.nominal) : ""}
                          </td>
                          <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 dark:text-gray-50">
                            {masuk ? "" : formatAngka(r.nominal)}
                          </td>
                          <td colSpan={tab === "penjualan" ? 4 : 3}></td>
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

      <Modal
        buka={formManual !== null}
        judul="Tambah Transaksi Manual"
        deskripsi={
          role === "STAFF" || role === "BENDAHARA"
            ? "Transaksi ke rekening bank akan berstatus Menunggu ACC Bendahara. Input ke petty cash langsung masuk tanpa ACC."
            : "Untuk transaksi yang tidak ada di mutasi bank, mis. kas tunai atau penyesuaian."
        }
        onTutup={() => setFormManual(null)}
      >
        {formManual && (
          <form onSubmit={simpanManual} className="grid gap-4 sm:grid-cols-2">
            <SearchableSelect
              label="Rekening"
              required
              value={formManual.rekeningId}
              onChange={(v) => setFormManual({ ...formManual, rekeningId: v })}
              options={rekening}
              placeholder="Pilih rekening"
              emptyText="Belum ada rekening"
            />
            <Field label="Tanggal" required>
              <input
                type="date"
                required
                value={formManual.tanggalIso}
                onChange={(e) => setFormManual({ ...formManual, tanggalIso: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>

            <div className="sm:col-span-2">
              <Field label="Keterangan" required>
                <input
                  required
                  value={formManual.keterangan}
                  onChange={(e) => setFormManual({ ...formManual, keterangan: e.target.value })}
                  placeholder="mis. Beli ATK gudang"
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Arah uang
              </label>
              <div
                role="radiogroup"
                aria-label="Arah uang"
                className="flex w-full rounded-lg border border-gray-300 bg-white p-1 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {(
                  [
                    { key: "keluar", label: "Uang keluar" },
                    { key: "masuk", label: "Uang masuk" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={formManual.arah === o.key}
                    onClick={() => setFormManual({ ...formManual, arah: o.key })}
                    className={cn(
                      "min-h-11 flex-1 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors",
                      formManual.arah === o.key
                        ? "bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-50"
                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-700"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="Nominal" required>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                value={formManual.nominal}
                onChange={(e) => setFormManual({ ...formManual, nominal: e.target.value })}
                placeholder="0"
                className={`${INPUT_CLASS} tabular-nums`}
              />
            </Field>

            <div className="sm:col-span-2">
              <SearchableSelect
                label="Kode akun"
                value={formManual.kodeAkunId}
                onChange={(v) => setFormManual({ ...formManual, kodeAkunId: v })}
                options={opsiKode}
                placeholder="Pilih kode (boleh dikosongkan dulu)"
                searchPlaceholder="Cari kode atau nama..."
                emptyText="Kode tidak ditemukan"
              />
            </div>
            <div className="sm:col-span-2">
              <Field label="Catatan">
                <input
                  value={formManual.catatan}
                  onChange={(e) => setFormManual({ ...formManual, catatan: e.target.value })}
                  placeholder="Opsional"
                  className={INPUT_CLASS}
                />
              </Field>
            </div>

            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" varian="sekunder" onClick={() => setFormManual(null)}>
                Batal
              </Button>
              <Button type="submit" loading={menyimpanManual}>
                Simpan
              </Button>
            </div>
          </form>
        )}
      </Modal>

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
