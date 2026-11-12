"use client";

import * as React from "react";
import {
  TrendingUp,
  Plus,
  FileSpreadsheet,
  Download,
  Trash2,
  Pencil,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Wallet,
  Coins,
  Package,
  Layers,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
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
  TabButton,
  TabList,
} from "@/components/ui/primitives";
import { formatRupiah, formatAngka, cn } from "@/lib/utils";

interface BrandItem {
  id: string;
  nama: string;
  kunci: string;
}

interface DetailBank {
  nama: string;
  nominal: number;
}

interface PertumbuhanRecord {
  id: string;
  brandId: string;
  brand: { id: string; nama: string };
  tahun: number;
  bulan: number;
  detailBank: DetailBank[] | null;
  cashOnBank: string | number;
  kasBesar: string | number;
  kasKecil: string | number;
  cashOnHand: string | number;
  piutangVendor: string | number;
  utangVendor: string | number;
  outstandingShopeeLazada: string | number;
  outstandingSap: string | number;
  outstandingJnt: string | number;
  outstandingTiktok: string | number;
  outstandingLainnya: string | number;
  outstanding: string | number;
  inventory: string | number;
  selisihInventory: string | number;
  total: string | number;
  pertumbuhanNominal: string | number;
  pertumbuhanPersen: string | number | null;
  hutangLainnya: string | number;
  keteranganHutang: string | null;
  catatan: string | null;
}

interface KonsolidasiItem {
  periode: string;
  tahun: number;
  bulan: number;
  perBrand: { [brandId: string]: { total: number; pertumbuhan: number } };
  total: number;
  pertumbuhan: number;
  pertumbuhanPersen: number | null;
}

const BULAN_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const BRAND_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2"];

export default function PertumbuhanBisnisPage() {
  const [tabAktif, setTabAktif] = React.useState<"konsolidasi" | "brand">("konsolidasi");
  const [memuat, setMemuat] = React.useState(true);
  const [brands, setBrands] = React.useState<BrandItem[]>([]);
  const [records, setRecords] = React.useState<PertumbuhanRecord[]>([]);
  const [konsolidasi, setKonsolidasi] = React.useState<KonsolidasiItem[]>([]);
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("");

  // Filter tahun (opsional, 'all' atau tahun tertentu)
  const [filterTahun, setFilterTahun] = React.useState<string>("all");

  // Modal Form State
  const [modalFormBuka, setModalFormBuka] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    id: "",
    brandId: "",
    tahun: new Date().getFullYear(),
    bulan: new Date().getMonth() + 1,
    detailBank: [{ nama: "BCA", nominal: 0 }] as DetailBank[],
    kasBesar: 0,
    kasKecil: 0,
    piutangVendor: 0,
    utangVendor: 0,
    outstandingShopeeLazada: 0,
    outstandingSap: 0,
    outstandingJnt: 0,
    outstandingTiktok: 0,
    outstandingLainnya: 0,
    inventory: 0,
    hutangLainnya: 0,
    keteranganHutang: "HUTANG ke PUSAT",
    catatan: "",
  });

  // Modal Impor State
  const [modalImporBuka, setModalImporBuka] = React.useState(false);
  const [fileImpor, setFileImpor] = React.useState<File | null>(null);
  const [mengimpor, setMengimpor] = React.useState(false);

  // Modal Hapus State
  const [hapusTarget, setHapusTarget] = React.useState<PertumbuhanRecord | null>(null);
  const [menghapus, setMenghapus] = React.useState(false);

  const muatData = React.useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch("/api/pertumbuhan-bisnis");
      if (res.status === 403) {
        toast.error("Akses ditolak: Menu ini khusus untuk FINANCE dan OWNER.");
        setMemuat(false);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setBrands(data.brands || []);
      setRecords(data.records || []);
      setKonsolidasi(data.konsolidasi || []);

      if (data.brands && data.brands.length > 0 && !selectedBrandId) {
        setSelectedBrandId(data.brands[0].id);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memuat data pertumbuhan bisnis");
    } finally {
      setMemuat(false);
    }
  }, [selectedBrandId]);

  React.useEffect(() => {
    muatData();
  }, [muatData]);

  // Daftar tahun unik untuk filter
  const daftarTahun = React.useMemo(() => {
    const setThn = new Set<number>();
    records.forEach((r) => setThn.add(r.tahun));
    return Array.from(setThn).sort((a, b) => b - a);
  }, [records]);

  // Konsolidasi yang sudah difilter tahun
  const filteredKonsolidasi = React.useMemo(() => {
    if (filterTahun === "all") return konsolidasi;
    return konsolidasi.filter((k) => k.tahun === Number(filterTahun));
  }, [konsolidasi, filterTahun]);

  // Records per brand yang sudah difilter
  const filteredBrandRecords = React.useMemo(() => {
    return records
      .filter((r) => r.brandId === selectedBrandId)
      .filter((r) => (filterTahun === "all" ? true : r.tahun === Number(filterTahun)))
      .sort((a, b) => a.tahun - b.tahun || a.bulan - b.bulan);
  }, [records, selectedBrandId, filterTahun]);

  // KPI Ringkasan
  const kpi = React.useMemo(() => {
    if (konsolidasi.length === 0) return null;
    const latest = konsolidasi[konsolidasi.length - 1];
    const prev = konsolidasi.length > 1 ? konsolidasi[konsolidasi.length - 2] : null;

    // Hitung brand kontributor terbesar pada bulan terakhir
    let topBrandNama = "-";
    let topBrandNominal = 0;
    if (latest && brands.length > 0) {
      for (const b of brands) {
        const val = latest.perBrand[b.id]?.total || 0;
        if (val > topBrandNominal) {
          topBrandNominal = val;
          topBrandNama = b.nama;
        }
      }
    }

    const persentaseKontribusi =
      latest.total > 0 ? ((topBrandNominal / latest.total) * 100).toFixed(1) : "0";

    return {
      periode: latest.periode,
      tahun: latest.tahun,
      bulan: BULAN_NAMES[latest.bulan - 1],
      totalAset: latest.total,
      pertumbuhan: latest.pertumbuhan,
      pertumbuhanPersen: latest.pertumbuhanPersen,
      topBrandNama,
      topBrandNominal,
      persentaseKontribusi,
      prevTotal: prev?.total || 0,
    };
  }, [konsolidasi, brands]);

  // Data untuk Grafik Recharts
  const chartData = React.useMemo(() => {
    return filteredKonsolidasi.map((k) => {
      const item: Record<string, string | number> = {
        name: `${BULAN_NAMES[k.bulan - 1].slice(0, 3)} ${k.tahun.toString().slice(2)}`,
        Konsolidasi: k.total,
      };
      for (const b of brands) {
        item[b.nama] = k.perBrand[b.id]?.total || 0;
      }
      return item;
    });
  }, [filteredKonsolidasi, brands]);

  // Live calculation saat input form modal
  const liveSubtotals = React.useMemo(() => {
    const cashOnBank = formData.detailBank.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
    const cashOnHand = Number(formData.kasBesar || 0) + Number(formData.kasKecil || 0);
    const piutang = Number(formData.piutangVendor || 0);
    const utang = Number(formData.utangVendor || 0);
    const outstanding =
      Number(formData.outstandingShopeeLazada || 0) +
      Number(formData.outstandingSap || 0) +
      Number(formData.outstandingJnt || 0) +
      Number(formData.outstandingTiktok || 0) +
      Number(formData.outstandingLainnya || 0);
    const inventory = Number(formData.inventory || 0);

    const total = cashOnBank + cashOnHand + piutang - utang + outstanding + inventory;
    return { cashOnBank, cashOnHand, outstanding, total };
  }, [formData]);

  function bukaModalInput(recordTarget?: PertumbuhanRecord) {
    if (recordTarget) {
      let banks: DetailBank[] = [];
      if (Array.isArray(recordTarget.detailBank) && recordTarget.detailBank.length > 0) {
        banks = recordTarget.detailBank.map((b) => ({ nama: b.nama, nominal: Number(b.nominal) || 0 }));
      } else {
        banks = [{ nama: "BCA", nominal: Number(recordTarget.cashOnBank) || 0 }];
      }

      setFormData({
        id: recordTarget.id,
        brandId: recordTarget.brandId,
        tahun: recordTarget.tahun,
        bulan: recordTarget.bulan,
        detailBank: banks,
        kasBesar: Number(recordTarget.kasBesar) || 0,
        kasKecil: Number(recordTarget.kasKecil) || 0,
        piutangVendor: Number(recordTarget.piutangVendor) || 0,
        utangVendor: Number(recordTarget.utangVendor) || 0,
        outstandingShopeeLazada: Number(recordTarget.outstandingShopeeLazada) || 0,
        outstandingSap: Number(recordTarget.outstandingSap) || 0,
        outstandingJnt: Number(recordTarget.outstandingJnt) || 0,
        outstandingTiktok: Number(recordTarget.outstandingTiktok) || 0,
        outstandingLainnya: Number(recordTarget.outstandingLainnya) || 0,
        inventory: Number(recordTarget.inventory) || 0,
        hutangLainnya: Number(recordTarget.hutangLainnya) || 0,
        keteranganHutang: recordTarget.keteranganHutang || "HUTANG ke PUSAT",
        catatan: recordTarget.catatan || "",
      });
    } else {
      // Form baru: ambil bank template sesuai brand yang dipilih
      const defaultBanks = [
        { nama: "BCA", nominal: 0 },
        { nama: "MANDIRI", nominal: 0 },
        { nama: "BSI", nominal: 0 },
      ];
      setFormData({
        id: "",
        brandId: selectedBrandId || (brands[0]?.id ?? ""),
        tahun: new Date().getFullYear(),
        bulan: new Date().getMonth() + 1,
        detailBank: defaultBanks,
        kasBesar: 0,
        kasKecil: 0,
        piutangVendor: 0,
        utangVendor: 0,
        outstandingShopeeLazada: 0,
        outstandingSap: 0,
        outstandingJnt: 0,
        outstandingTiktok: 0,
        outstandingLainnya: 0,
        inventory: 0,
        hutangLainnya: 0,
        keteranganHutang: "HUTANG ke PUSAT",
        catatan: "",
      });
    }
    setModalFormBuka(true);
  }

  async function simpanForm(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.brandId) {
      toast.error("Pilih brand terlebih dahulu");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/pertumbuhan-bisnis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || "Data berhasil disimpan");
      setModalFormBuka(false);
      muatData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  }

  async function hapusRecord() {
    if (!hapusTarget) return;
    setMenghapus(true);
    try {
      const res = await fetch(`/api/pertumbuhan-bisnis/${hapusTarget.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Rekap bulan berhasil dihapus");
      setHapusTarget(null);
      muatData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus data");
      setHapusTarget(null);
    } finally {
      setMenghapus(false);
    }
  }

  async function kirimImpor(e: React.FormEvent) {
    e.preventDefault();
    if (!fileImpor) {
      toast.error("Pilih file Excel terlebih dahulu");
      return;
    }
    setMengimpor(true);
    try {
      const fd = new FormData();
      fd.append("file", fileImpor);

      const res = await fetch("/api/pertumbuhan-bisnis/impor", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(data.message || "Impor berhasil diselesaikan");
      setModalImporBuka(false);
      setFileImpor(null);
      muatData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal mengimpor file Excel");
    } finally {
      setMengimpor(false);
    }
  }

  function unduhExcel() {
    window.open("/api/pertumbuhan-bisnis/ekspor", "_blank");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        judul="Rekap Pertumbuhan Bisnis"
        deskripsi="Rekap manual pertumbuhan aset, kas, saldo tertahan marketplace, & persediaan per brand. Khusus untuk Finance dan Owner."
        aksi={
          <div className="flex flex-wrap items-center gap-2">
            <Button varian="sekunder" onClick={unduhExcel} title="Unduh laporan lengkap dalam format Excel">
              <Download className="h-4 w-4" />
              Unduh Excel
            </Button>
            <Button varian="sekunder" onClick={() => setModalImporBuka(true)} title="Unggah file spreadsheet .xlsx">
              <FileSpreadsheet className="h-4 w-4" />
              Impor Excel
            </Button>
            <Button varian="primer" onClick={() => bukaModalInput()}>
              <Plus className="h-4 w-4" />
              Input Bulan
            </Button>
          </div>
        }
      />

      {/* KPI CARDS */}
      {kpi && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Nilai Bisnis (Aset Gabungan)</p>
              <h3 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
                {formatRupiah(kpi.totalAset)}
              </h3>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-700 dark:text-gray-300">
                Periode: {kpi.bulan} {kpi.tahun}
              </span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Pertumbuhan Bulan Ini (MoM)</p>
              <div className="mt-1 flex items-baseline gap-2">
                <h3
                  className={cn(
                    "text-2xl font-bold tracking-tight",
                    kpi.pertumbuhan >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  )}
                >
                  {kpi.pertumbuhan >= 0 ? "+" : ""}
                  {formatRupiah(kpi.pertumbuhan)}
                </h3>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs">
              {kpi.pertumbuhan >= 0 ? (
                <span className="inline-flex items-center font-medium text-green-600 dark:text-green-400">
                  <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />
                  {kpi.pertumbuhanPersen !== null ? `${kpi.pertumbuhanPersen.toFixed(2)}%` : ""}
                </span>
              ) : (
                <span className="inline-flex items-center font-medium text-red-600 dark:text-red-400">
                  <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />
                  {kpi.pertumbuhanPersen !== null ? `${kpi.pertumbuhanPersen.toFixed(2)}%` : ""}
                </span>
              )}
              <span className="text-gray-500 dark:text-gray-400">vs {formatRupiah(kpi.prevTotal)}</span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Kontributor Terbesar</p>
              <h3 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-50">{kpi.topBrandNama}</h3>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>{formatRupiah(kpi.topBrandNominal)}</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {kpi.persentaseKontribusi}% dari total
              </span>
            </div>
          </Card>

          <Card className="flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Brand & Riwayat</p>
              <h3 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-50">{brands.length} Brand Aktif</h3>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Layers className="h-3.5 w-3.5 text-gray-400" />
              <span>{konsolidasi.length} Periode Bulan Tercatat</span>
            </div>
          </Card>
        </div>
      )}

      {/* GRAFIK TREN KONSOLIDASI */}
      {chartData.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">Tren Pertumbuhan Nilai Bisnis</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pergerakan total aset bersih gabungan dan per brand per bulan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Filter Tahun:</span>
              <select
                value={filterTahun}
                onChange={(e) => setFilterTahun(e.target.value)}
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-100"
              >
                <option value="all">Semua Tahun</option>
                {daftarTahun.map((thn) => (
                  <option key={thn} value={thn}>
                    Tahun {thn}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorKonsolidasi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={(val) => {
                    if (val >= 1e9) return `${(val / 1e9).toFixed(1)} M`;
                    if (val >= 1e6) return `${(val / 1e6).toFixed(0)} Jt`;
                    return String(val);
                  }}
                  tick={{ fontSize: 11 }}
                  width={55}
                />
                <Tooltip
                  formatter={(val: any) => [formatRupiah(val), ""]}
                  contentStyle={{
                    backgroundColor: "rgba(15, 23, 42, 0.95)",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#fff",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Area
                  type="monotone"
                  dataKey="Konsolidasi"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorKonsolidasi)"
                />
                {brands.map((b, idx) => (
                  <Area
                    key={b.id}
                    type="monotone"
                    dataKey={b.nama}
                    stroke={BRAND_COLORS[(idx + 1) % BRAND_COLORS.length]}
                    strokeWidth={1.5}
                    fillOpacity={0}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* TAB NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabList label="Tampilan Rekap">
          <TabButton aktif={tabAktif === "konsolidasi"} onClick={() => setTabAktif("konsolidasi")}>
            <Layers className="mr-1.5 inline-flex h-4 w-4" />
            Rekap Konsolidasi (Semua Brand)
          </TabButton>
          <TabButton aktif={tabAktif === "brand"} onClick={() => setTabAktif("brand")}>
            <Building2 className="mr-1.5 inline-flex h-4 w-4" />
            Detail per Brand
          </TabButton>
        </TabList>

        {tabAktif === "brand" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Pilih Brand:</span>
            <div className="flex gap-1 overflow-x-auto">
              {brands.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setSelectedBrandId(b.id)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors",
                    selectedBrandId === b.id
                      ? "bg-blue-600 text-white dark:bg-blue-500"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-300 dark:hover:bg-zinc-700"
                  )}
                >
                  {b.nama}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: KONSOLIDASI */}
      {tabAktif === "konsolidasi" && (
        <Card>
          {memuat ? (
            <Skeleton />
          ) : filteredKonsolidasi.length === 0 ? (
            <EmptyState
              pesan="Belum ada data rekapan. Klik 'Input Bulan' atau 'Impor Excel' untuk memulai."
              aksi={
                <Button varian="primer" onClick={() => bukaModalInput()}>
                  <Plus className="h-4 w-4" />
                  Input Bulan
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-gray-300">
                    <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2.5 dark:bg-zinc-800">Brand / Keterangan</th>
                    {filteredKonsolidasi.map((k) => (
                      <th key={k.periode} className="px-3 py-2.5 text-right whitespace-nowrap">
                        {BULAN_NAMES[k.bulan - 1].slice(0, 3)} {k.tahun}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {brands.map((b) => (
                    <React.Fragment key={b.id}>
                      <tr className="hover:bg-gray-50/50 dark:hover:bg-zinc-800/30">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-gray-900 dark:bg-zinc-900 dark:text-gray-100">
                          {b.nama} (Total)
                        </td>
                        {filteredKonsolidasi.map((k) => {
                          const val = k.perBrand[b.id]?.total || 0;
                          return (
                            <td key={k.periode} className="px-3 py-2 text-right font-medium tabular-nums text-gray-800 dark:text-gray-200">
                              {val > 0 ? formatAngka(val, 0) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                      <tr className="bg-gray-50/30 text-[11px] text-gray-500 hover:bg-gray-50/60 dark:bg-zinc-800/10 dark:text-gray-400">
                        <td className="sticky left-0 z-10 bg-gray-50/30 px-3 py-1.5 italic text-gray-500 dark:bg-zinc-900 dark:text-gray-400">
                          {b.nama} (Pertumbuhan)
                        </td>
                        {filteredKonsolidasi.map((k) => {
                          const val = k.perBrand[b.id]?.pertumbuhan || 0;
                          return (
                            <td
                              key={k.periode}
                              className={cn(
                                "px-3 py-1.5 text-right tabular-nums",
                                val > 0
                                  ? "text-green-600 dark:text-green-400"
                                  : val < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-400"
                              )}
                            >
                              {val !== 0 ? (val > 0 ? `+${formatAngka(val, 0)}` : formatAngka(val, 0)) : "-"}
                            </td>
                          );
                        })}
                      </tr>
                    </React.Fragment>
                  ))}

                  {/* GRAND TOTAL KONSOLIDASI */}
                  <tr className="border-t-2 border-gray-300 bg-blue-50/60 font-bold text-gray-900 dark:border-zinc-600 dark:bg-blue-950/30 dark:text-gray-50">
                    <td className="sticky left-0 z-10 bg-blue-50/90 px-3 py-2.5 text-blue-900 dark:bg-zinc-800 dark:text-blue-300">
                      TOTAL KONSOLIDASI
                    </td>
                    {filteredKonsolidasi.map((k) => (
                      <td key={k.periode} className="px-3 py-2.5 text-right font-bold tabular-nums text-blue-900 dark:text-blue-300">
                        {formatAngka(k.total, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b-2 border-gray-200 bg-gray-100/50 font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/40 dark:text-gray-300">
                    <td className="sticky left-0 z-10 bg-gray-100/80 px-3 py-2 text-gray-700 dark:bg-zinc-800 dark:text-gray-300">
                      PERTUMBUHAN KONSOLIDASI
                    </td>
                    {filteredKonsolidasi.map((k) => (
                      <td
                        key={k.periode}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          k.pertumbuhan > 0
                            ? "text-green-600 dark:text-green-400"
                            : k.pertumbuhan < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500"
                        )}
                      >
                        {k.pertumbuhan !== 0
                          ? `${k.pertumbuhan > 0 ? "+" : ""}${formatAngka(k.pertumbuhan, 0)} (${k.pertumbuhanPersen !== null ? k.pertumbuhanPersen.toFixed(1) : 0}%)`
                          : "-"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: DETAIL PER BRAND */}
      {tabAktif === "brand" && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-zinc-800">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                Detail Laporan: {brands.find((b) => b.id === selectedBrandId)?.nama || "Brand"}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Rincian komponen per baris sesuai lembar kerja keuangan tim Finance
              </p>
            </div>
            <Button
              varian="primer"
              onClick={() => {
                bukaModalInput();
              }}
            >
              <Plus className="h-4 w-4" />
              Input Bulan untuk Brand Ini
            </Button>
          </div>

          {memuat ? (
            <Skeleton />
          ) : filteredBrandRecords.length === 0 ? (
            <EmptyState
              pesan={`Belum ada data untuk brand ini. Klik 'Input Bulan' untuk mengisi data baru.`}
              aksi={
                <Button varian="primer" onClick={() => bukaModalInput()}>
                  <Plus className="h-4 w-4" />
                  Input Bulan
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-left font-semibold text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-gray-300">
                    <th className="sticky left-0 z-10 min-w-[200px] bg-gray-50 px-3 py-2.5 dark:bg-zinc-800">Komponen</th>
                    {filteredBrandRecords.map((r) => (
                      <th key={r.id} className="min-w-[125px] px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <span>
                            {BULAN_NAMES[r.bulan - 1].slice(0, 3)} {r.tahun}
                          </span>
                          <button
                            type="button"
                            title="Edit bulan ini"
                            onClick={() => bukaModalInput(r)}
                            className="rounded p-0.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-zinc-700 dark:hover:text-gray-200"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title="Hapus bulan ini"
                            onClick={() => setHapusTarget(r)}
                            className="rounded p-0.5 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800 dark:divide-zinc-800 dark:text-gray-200">
                  {/* CASH ON BANK */}
                  <tr className="bg-blue-50/40 font-semibold text-blue-950 dark:bg-blue-950/20 dark:text-blue-300">
                    <td className="sticky left-0 z-10 bg-blue-50/80 px-3 py-2 dark:bg-zinc-900">Cash On Bank (Total)</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatAngka(r.cashOnBank, 0)}
                      </td>
                    ))}
                  </tr>

                  {/* CASH ON HAND */}
                  <tr className="bg-amber-50/30 font-semibold text-amber-950 dark:bg-amber-950/20 dark:text-amber-300">
                    <td className="sticky left-0 z-10 bg-amber-50/70 px-3 py-2 dark:bg-zinc-900">Cash On Hand (Total)</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatAngka(r.cashOnHand, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 dark:bg-zinc-900">â”” Kas Besar</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(r.kasBesar, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 dark:bg-zinc-900">â”” Kas Kecil</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(r.kasKecil, 0)}
                      </td>
                    ))}
                  </tr>

                  {/* PIUTANG & UTANG */}
                  <tr>
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-gray-900 dark:bg-zinc-900 dark:text-gray-100">
                      Piutang Vendor
                    </td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                        {formatAngka(r.piutangVendor, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-red-700 dark:bg-zinc-900 dark:text-red-400">
                      Utang Vendor (Pengurang)
                    </td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                        {Number(r.utangVendor) > 0 ? `-${formatAngka(r.utangVendor, 0)}` : "0"}
                      </td>
                    ))}
                  </tr>

                  {/* OUTSTANDING */}
                  <tr className="bg-purple-50/40 font-semibold text-purple-950 dark:bg-purple-950/20 dark:text-purple-300">
                    <td className="sticky left-0 z-10 bg-purple-50/80 px-3 py-2 dark:bg-zinc-900">
                      Outstanding Marketplace & COD
                    </td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatAngka(r.outstanding, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 dark:bg-zinc-900">â”” Shopee & Lazada</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(r.outstandingShopeeLazada, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 dark:bg-zinc-900">â”” SAP</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(r.outstandingSap, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 dark:bg-zinc-900">â”” JNT</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(r.outstandingJnt, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 dark:bg-zinc-900">â”” Tiktok</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-1.5 text-right tabular-nums">
                        {formatAngka(r.outstandingTiktok, 0)}
                      </td>
                    ))}
                  </tr>

                  {/* INVENTORY */}
                  <tr className="bg-emerald-50/40 font-semibold text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-300">
                    <td className="sticky left-0 z-10 bg-emerald-50/80 px-3 py-2 dark:bg-zinc-900">Inventory (Persediaan)</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right font-semibold tabular-nums">
                        {formatAngka(r.inventory, 0)}
                      </td>
                    ))}
                  </tr>
                  <tr className="text-[11px] text-gray-500 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white pl-6 italic dark:bg-zinc-900">Selisih Inventory vs Bulan Lalu</td>
                    {filteredBrandRecords.map((r) => {
                      const sel = Number(r.selisihInventory);
                      return (
                        <td
                          key={r.id}
                          className={cn(
                            "px-3 py-1.5 text-right tabular-nums",
                            sel > 0
                              ? "text-green-600 dark:text-green-400"
                              : sel < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-400"
                          )}
                        >
                          {sel !== 0 ? (sel > 0 ? `+${formatAngka(sel, 0)}` : formatAngka(sel, 0)) : "-"}
                        </td>
                      );
                    })}
                  </tr>

                  {/* TOTAL */}
                  <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold text-gray-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-gray-50">
                    <td className="sticky left-0 z-10 bg-gray-200 px-3 py-2.5 text-sm font-bold dark:bg-zinc-700">
                      TOTAL NILAI BISNIS
                    </td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2.5 text-right text-sm font-bold tabular-nums">
                        {formatAngka(r.total, 0)}
                      </td>
                    ))}
                  </tr>

                  {/* PERTUMBUHAN */}
                  <tr className="border-b-2 border-gray-300 bg-gray-50 font-semibold dark:border-zinc-700 dark:bg-zinc-800/40">
                    <td className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-xs font-semibold dark:bg-zinc-800">
                      Pertumbuhan (MoM)
                    </td>
                    {filteredBrandRecords.map((r) => {
                      const nom = Number(r.pertumbuhanNominal);
                      const pct = r.pertumbuhanPersen !== null ? Number(r.pertumbuhanPersen) : null;
                      return (
                        <td
                          key={r.id}
                          className={cn(
                            "px-3 py-2 text-right tabular-nums",
                            nom > 0
                              ? "text-green-600 dark:text-green-400"
                              : nom < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-400"
                          )}
                        >
                          {nom !== 0 ? `${nom > 0 ? "+" : ""}${formatAngka(nom, 0)}` : "-"}
                          {pct !== null && <span className="block text-[10px]">({pct.toFixed(1)}%)</span>}
                        </td>
                      );
                    })}
                  </tr>

                  {/* HUTANG KE PUSAT & CATATAN */}
                  <tr className="bg-gray-50/20 text-[11px] text-gray-600 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium dark:bg-zinc-900">
                      Hutang ke Pusat / Brand Lain
                    </td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right tabular-nums">
                        {Number(r.hutangLainnya) > 0 ? formatAngka(r.hutangLainnya, 0) : "-"}
                      </td>
                    ))}
                  </tr>
                  <tr className="bg-gray-50/20 text-[11px] text-gray-500 dark:text-gray-400">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2 italic dark:bg-zinc-900">Catatan Tambahan</td>
                    {filteredBrandRecords.map((r) => (
                      <td key={r.id} className="px-3 py-2 text-right text-[10px] text-gray-500 italic">
                        {r.catatan || "-"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* MODAL INPUT / EDIT MANUAL */}
      <Modal
        buka={modalFormBuka}
        judul={formData.id ? "Edit Rekap Pertumbuhan Bisnis" : "Input Manual Rekap Pertumbuhan Bisnis"}
        deskripsi="Form pengisian manual oleh tim Finance. Seluruh subtotal dan nilai bisnis bersih dihitung secara otomatis."
        onTutup={() => setModalFormBuka(false)}
      >
        <form onSubmit={simpanForm} className="max-h-[80vh] space-y-5 overflow-y-auto pr-1">
          {/* Identitas Brand & Periode */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Brand" required>
              <select
                disabled={Boolean(formData.id)}
                value={formData.brandId}
                onChange={(e) => setFormData({ ...formData, brandId: e.target.value })}
                className={INPUT_CLASS}
                required
              >
                <option value="">-- Pilih Brand --</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.nama}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tahun" required>
              <input
                type="number"
                disabled={Boolean(formData.id)}
                value={formData.tahun}
                onChange={(e) => setFormData({ ...formData, tahun: Number(e.target.value) })}
                className={INPUT_CLASS}
                min={2020}
                max={2099}
                required
              />
            </Field>
            <Field label="Bulan" required>
              <select
                disabled={Boolean(formData.id)}
                value={formData.bulan}
                onChange={(e) => setFormData({ ...formData, bulan: Number(e.target.value) })}
                className={INPUT_CLASS}
                required
              >
                {BULAN_NAMES.map((namaBulan, idx) => (
                  <option key={idx + 1} value={idx + 1}>
                    {namaBulan}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {/* BAGIAN 1: KAS DI BANK */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Wallet className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">1. Cash On Bank (Kas di Bank)</h4>
              </div>
              <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                Subtotal: {formatRupiah(liveSubtotals.cashOnBank)}
              </span>
            </div>

            <div className="space-y-2">
              {formData.detailBank.map((bank, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Nama Bank (misal: BCA)"
                    value={bank.nama}
                    onChange={(e) => {
                      const next = [...formData.detailBank];
                      next[index].nama = e.target.value;
                      setFormData({ ...formData, detailBank: next });
                    }}
                    className={cn(INPUT_CLASS, "w-1/3")}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Nominal (Rp)"
                    value={bank.nominal || ""}
                    onChange={(e) => {
                      const next = [...formData.detailBank];
                      next[index].nominal = Number(e.target.value) || 0;
                      setFormData({ ...formData, detailBank: next });
                    }}
                    className={cn(INPUT_CLASS, "flex-1")}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = formData.detailBank.filter((_, i) => i !== index);
                      setFormData({ ...formData, detailBank: next });
                    }}
                    className="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <Button
                type="button"
                varian="sekunder"
                className="mt-1 w-full text-xs"
                onClick={() => {
                  setFormData({
                    ...formData,
                    detailBank: [...formData.detailBank, { nama: "Bank Baru", nominal: 0 }],
                  });
                }}
              >
                + Tambah Akun Bank
              </Button>
            </div>
          </div>

          {/* BAGIAN 2: KAS TUNAI (CASH ON HAND) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Coins className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">2. Cash On Hand (Kas Fisik)</h4>
              </div>
              <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
                Subtotal: {formatRupiah(liveSubtotals.cashOnHand)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Kas Besar">
                <input
                  type="number"
                  step="any"
                  value={formData.kasBesar || ""}
                  onChange={(e) => setFormData({ ...formData, kasBesar: Number(e.target.value) || 0 })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Kas Kecil">
                <input
                  type="number"
                  step="any"
                  value={formData.kasKecil || ""}
                  onChange={(e) => setFormData({ ...formData, kasKecil: Number(e.target.value) || 0 })}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </div>

          {/* BAGIAN 3: PIUTANG & UTANG VENDOR */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Piutang Vendor (+)">
              <input
                type="number"
                step="any"
                value={formData.piutangVendor || ""}
                onChange={(e) => setFormData({ ...formData, piutangVendor: Number(e.target.value) || 0 })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Utang Vendor (-)" hint="Otomatis mengurangi total aset">
              <input
                type="number"
                step="any"
                value={formData.utangVendor || ""}
                onChange={(e) => setFormData({ ...formData, utangVendor: Number(e.target.value) || 0 })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          {/* BAGIAN 4: OUTSTANDING MARKETPLACE & COD */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="mb-2.5 flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                3. Outstanding (Marketplace & COD)
              </h4>
              <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                Subtotal: {formatRupiah(liveSubtotals.outstanding)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Field label="Shopee & Lazada">
                <input
                  type="number"
                  step="any"
                  value={formData.outstandingShopeeLazada || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, outstandingShopeeLazada: Number(e.target.value) || 0 })
                  }
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="SAP">
                <input
                  type="number"
                  step="any"
                  value={formData.outstandingSap || ""}
                  onChange={(e) => setFormData({ ...formData, outstandingSap: Number(e.target.value) || 0 })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="JNT">
                <input
                  type="number"
                  step="any"
                  value={formData.outstandingJnt || ""}
                  onChange={(e) => setFormData({ ...formData, outstandingJnt: Number(e.target.value) || 0 })}
                  className={INPUT_CLASS}
                />
              </Field>
              <Field label="Tiktok">
                <input
                  type="number"
                  step="any"
                  value={formData.outstandingTiktok || ""}
                  onChange={(e) => setFormData({ ...formData, outstandingTiktok: Number(e.target.value) || 0 })}
                  className={INPUT_CLASS}
                />
              </Field>
            </div>
          </div>

          {/* BAGIAN 5: INVENTORY (PERSEDIAAN) */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/40">
            <div className="mb-2 flex items-center gap-1.5">
              <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">4. Inventory (Nilai Stok Akhir Bulan)</h4>
            </div>
            <Field label="Total Nilai Inventory (Rp)" hint="Selisih inventory vs bulan lalu otomatis dihitung oleh sistem">
              <input
                type="number"
                step="any"
                value={formData.inventory || ""}
                onChange={(e) => setFormData({ ...formData, inventory: Number(e.target.value) || 0 })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          {/* BAGIAN 6: HUTANG LAINNYA & CATATAN */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Hutang ke Pusat / Brand Lain (Catatan)">
              <input
                type="number"
                step="any"
                value={formData.hutangLainnya || ""}
                onChange={(e) => setFormData({ ...formData, hutangLainnya: Number(e.target.value) || 0 })}
                className={INPUT_CLASS}
              />
            </Field>
            <Field label="Keterangan Hutang">
              <input
                type="text"
                placeholder="misal: HUTANG ke PUSAT"
                value={formData.keteranganHutang}
                onChange={(e) => setFormData({ ...formData, keteranganHutang: e.target.value })}
                className={INPUT_CLASS}
              />
            </Field>
          </div>

          <Field label="Catatan Tambahan (Opsional)" hint="misal: *Inventory + Bahan Baku, *Pinjam MS, dll">
            <input
              type="text"
              placeholder="Catatan penyesuaian bulan ini"
              value={formData.catatan}
              onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
              className={INPUT_CLASS}
            />
          </Field>

          {/* LIVE SUMMARY RESULT */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 dark:border-blue-900/40 dark:bg-blue-950/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">TOTAL ESTIMASI NILAI BISNIS</p>
                <p className="text-[11px] text-blue-700 dark:text-blue-300">
                  Bank ({formatAngka(liveSubtotals.cashOnBank, 0)}) + Kas ({formatAngka(liveSubtotals.cashOnHand, 0)}) +
                  Piutang ({formatAngka(formData.piutangVendor || 0, 0)}) - Utang (
                  {formatAngka(formData.utangVendor || 0, 0)}) + Outstanding (
                  {formatAngka(liveSubtotals.outstanding, 0)}) + Inv ({formatAngka(formData.inventory || 0, 0)})
                </p>
              </div>
              <h3 className="text-xl font-extrabold text-blue-900 dark:text-blue-100">
                {formatRupiah(liveSubtotals.total)}
              </h3>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" varian="sekunder" onClick={() => setModalFormBuka(false)}>
              Batal
            </Button>
            <Button type="submit" varian="primer" loading={saving}>
              Simpan Rekap
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL IMPOR EXCEL */}
      <Modal
        buka={modalImporBuka}
        judul="Impor Rekap Pertumbuhan dari Excel"
        deskripsi="Unggah file spreadsheet .xlsx seperti 'CORETAN PROGRES _ Pertumbuhan Bisnis.xlsx'. Sistem akan otomatis memetakan data seluruh brand dan bulan."
        onTutup={() => setModalImporBuka(false)}
      >
        <form onSubmit={kirimImpor} className="space-y-4">
          <Field label="Pilih File Excel (.xlsx)" required>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFileImpor(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-zinc-800 dark:file:text-blue-400"
              required
            />
          </Field>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-gray-400">
            <p className="font-semibold text-gray-800 dark:text-gray-200">Format yang didukung:</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>Workbook dengan sheet multi-brand (Zaneva, Oberbe, Be Syari, Muswim)</li>
              <li>Kolom tanggal pada baris kedua (format YYYY-MM-DD atau Date)</li>
              <li>Baris Cash On Bank, Cash On Hand, Piutang, Utang, Outstanding, dan Inventory</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" varian="sekunder" onClick={() => setModalImporBuka(false)}>
              Batal
            </Button>
            <Button type="submit" varian="primer" loading={mengimpor}>
              Unggah & Proses
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DIALOG HAPUS */}
      <ConfirmDialog
        buka={hapusTarget !== null}
        judul="Hapus Rekap Bulan Ini?"
        pesan={`Data rekap ${hapusTarget?.brand.nama} periode ${
          hapusTarget ? BULAN_NAMES[hapusTarget.bulan - 1] : ""
        } ${hapusTarget?.tahun} akan dihapus. Perhitungan pertumbuhan bulan sesudahnya akan dihitung ulang secara otomatis.`}
        loading={menghapus}
        onKonfirmasi={hapusRecord}
        onBatal={() => setHapusTarget(null)}
      />
    </div>
  );
}
