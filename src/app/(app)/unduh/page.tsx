"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Info, Landmark, CalendarRange } from "lucide-react";
import { toast } from "sonner";
import {
  Button,
  Card,
  EmptyState,
  Field,
  INPUT_CLASS,
  PageHeader,
  Skeleton,
  TabButton,
  TabList,
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { labelRekening, tanggalKeIso } from "@/lib/utils";

interface Rekening {
  id: string;
  nama: string;
  bank: string;
  nomorRekening: string | null;
  aktif: boolean;
  brand: { id: string; nama: string } | null;
  _count: { transaksi: number };
}

interface RingkasRekening {
  id: string;
  jumlah: number;
}

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** YYYY-MM-DD dari komponen lokal — bukan toISOString, supaya tidak geser sehari. */
function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function hitungPreset(kunci: string): { dari: string; sampai: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const hariIni = iso(y, m, now.getDate());
  switch (kunci) {
    case "bulan-ini":
      return { dari: iso(y, m, 1), sampai: hariIni };
    case "bulan-lalu": {
      const akhir = new Date(y, m, 0);
      return {
        dari: iso(akhir.getFullYear(), akhir.getMonth(), 1),
        sampai: iso(akhir.getFullYear(), akhir.getMonth(), akhir.getDate()),
      };
    }
    case "kuartal-ini": {
      const awal = Math.floor(m / 3) * 3;
      return { dari: iso(y, awal, 1), sampai: hariIni };
    }
    case "tahun-ini":
      return { dari: iso(y, 0, 1), sampai: hariIni };
    case "semua":
      return { dari: "", sampai: "" };
    default:
      return null;
  }
}

function tanggalPanjang(isoStr: string) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

const PRESET = [
  { key: "bulan-ini", label: "Bulan ini" },
  { key: "bulan-lalu", label: "Bulan lalu" },
  { key: "kuartal-ini", label: "Kuartal ini" },
  { key: "tahun-ini", label: "Tahun ini" },
  { key: "semua", label: "Semua data" },
];

export default function UnduhPage() {
  const [rekening, setRekening] = React.useState<Rekening[]>([]);
  const [memuat, setMemuat] = React.useState(true);

  const [pilihan, setPilihan] = React.useState<string[]>([]);
  const [preset, setPreset] = React.useState<string>("bulan-ini");
  const [dari, setDari] = React.useState("");
  const [sampai, setSampai] = React.useState("");

  const [ringkas, setRingkas] = React.useState<RingkasRekening[] | null>(null);
  const [menghitung, setMenghitung] = React.useState(false);
  const [mengunduh, setMengunduh] = React.useState(false);

  // Preset bulan ini jadi titik awal — staff paling sering minta rekap bulanan.
  React.useEffect(() => {
    const p = hitungPreset("bulan-ini");
    if (p) {
      setDari(p.dari);
      setSampai(p.sampai);
    }
  }, []);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rekening");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const aktif: Rekening[] = (data.rekening ?? []).filter((r: Rekening) => r.aktif);
        setRekening(aktif);
        // Semua rekening terpilih di awal: satu klik langsung dapat semuanya.
        setPilihan(aktif.map((r) => r.id));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Gagal memuat rekening");
      } finally {
        setMemuat(false);
      }
    })();
  }, []);

  const pilihPreset = (kunci: string) => {
    setPreset(kunci);
    const p = hitungPreset(kunci);
    if (p) {
      setDari(p.dari);
      setSampai(p.sampai);
    }
  };

  /* ── Ringkasan: berapa transaksi & total uang per rekening ─────────────── */
  React.useEffect(() => {
    if (pilihan.length === 0) {
      setRingkas([]);
      return;
    }
    let batal = false;
    setMenghitung(true);
    (async () => {
      try {
        const hasil = await Promise.all(
          pilihan.map(async (id) => {
            const q = new URLSearchParams({ rekeningId: id, perHalaman: "1", halaman: "1" });
            if (dari) q.set("dari", dari);
            if (sampai) q.set("sampai", sampai);
            const res = await fetch(`/api/transaksi?${q}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            return { id, jumlah: data.total ?? 0 } satisfies RingkasRekening;
          })
        );
        if (!batal) setRingkas(hasil);
      } catch {
        if (!batal) setRingkas(null);
      } finally {
        if (!batal) setMenghitung(false);
      }
    })();
    return () => {
      batal = true;
    };
  }, [pilihan, dari, sampai]);

  const opsiRekening = rekening.map((r) => ({
    value: r.id,
    label: labelRekening(r.nama, r.nomorRekening),
    hint: [r.brand?.nama, `${r._count.transaksi} transaksi`].filter(Boolean).join(" · "),
  }));

  const totalTransaksi = (ringkas ?? []).reduce((a, r) => a + r.jumlah, 0);
  const adaRentangSalah = Boolean(dari && sampai && dari > sampai);

  function unduh() {
    if (pilihan.length === 0) {
      toast.error("Pilih minimal satu rekening");
      return;
    }
    if (adaRentangSalah) {
      toast.error("Tanggal awal tidak boleh setelah tanggal akhir");
      return;
    }
    if (totalTransaksi === 0) {
      toast.error("Tidak ada transaksi pada rentang ini — coba longgarkan periodenya");
      return;
    }

    const q = new URLSearchParams();
    // Satu rekening → mode single-sheet. Lebih dari satu → satu sheet per rekening.
    for (const id of pilihan) q.append("rekeningId", id);
    if (dari) q.set("dari", dari);
    if (sampai) q.set("sampai", sampai);

    setMengunduh(true);
    window.location.href = `/api/export/rekap?${q}`;
    // Unduhan browser tidak memberi event selesai; lepaskan status setelah jeda wajar.
    setTimeout(() => setMengunduh(false), 2500);
  }

  const namaFilePerkiraan =
    pilihan.length > 1
      ? `Rekap_${pilihan.length}_Rekening_${dari && sampai ? `${dari}_sd_${sampai}` : tanggalKeIso(new Date())}.xlsx`
      : `Rekap_${(rekening.find((r) => r.id === pilihan[0])?.nama ?? "Rekening")
          .replace(/[^\w-]+/g, "_")}_${dari && sampai ? `${dari}_sd_${sampai}` : tanggalKeIso(new Date())}.xlsx`;

  return (
    <>
      <PageHeader
        judul="Unduh Rekapan"
        deskripsi="Pilih rekening dan rentang tanggal, lalu unduh rekapnya sebagai Excel. Bisa satu rekening, bisa sekaligus banyak."
      />

      {memuat ? (
        <Card>
          <Skeleton baris={4} />
        </Card>
      ) : rekening.length === 0 ? (
        <Card>
          <EmptyState pesan="Belum ada rekening aktif. Tambahkan rekening dulu di menu Rekening." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] lg:items-start">
          {/* Kolom kiri: pilihan */}
          <div className="space-y-4">
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Landmark className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Rekening</h2>
              </div>

              <SearchableSelect
                multiple
                label="Rekening yang diunduh"
                value={pilihan}
                onChange={setPilihan}
                options={opsiRekening}
                placeholder="Pilih satu atau beberapa rekening"
                searchPlaceholder="Cari nama atau nomor rekening..."
                emptyText="Rekening tidak ditemukan"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  varian="sekunder"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setPilihan(rekening.map((r) => r.id))}
                  type="button"
                >
                  Pilih semua ({rekening.length})
                </Button>
                <Button
                  varian="sekunder"
                  className="min-h-9 px-3 py-1.5 text-xs"
                  onClick={() => setPilihan([])}
                  type="button"
                  disabled={pilihan.length === 0}
                >
                  Kosongkan
                </Button>
              </div>

              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                {pilihan.length === 0
                  ? "Belum ada rekening dipilih."
                  : pilihan.length === 1
                    ? "Satu rekening → file berisi satu sheet, lengkap dengan saldo awal."
                    : `${pilihan.length} rekening → satu file berisi ${pilihan.length} sheet (satu per rekening) plus sheet Ringkasan.`}
              </p>
            </Card>

            <Card>
              <div className="mb-3 flex items-center gap-2">
                <CalendarRange className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Rentang waktu</h2>
              </div>

              <TabList label="Pilih periode" className="mb-3">
                {PRESET.map((p) => (
                  <TabButton
                    key={p.key}
                    aktif={preset === p.key}
                    onClick={() => pilihPreset(p.key)}
                  >
                    {p.label}
                  </TabButton>
                ))}
              </TabList>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Dari tanggal" htmlFor="dari">
                  <input
                    id="dari"
                    type="date"
                    value={dari}
                    onChange={(e) => {
                      setDari(e.target.value);
                      setPreset("kustom");
                    }}
                    className={INPUT_CLASS}
                  />
                </Field>
                <Field label="Sampai tanggal" htmlFor="sampai">
                  <input
                    id="sampai"
                    type="date"
                    value={sampai}
                    onChange={(e) => {
                      setSampai(e.target.value);
                      setPreset("kustom");
                    }}
                    className={INPUT_CLASS}
                  />
                </Field>
              </div>

              <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                {adaRentangSalah
                  ? "Tanggal awal melewati tanggal akhir — perbaiki dulu."
                  : dari && sampai
                    ? `Rekap ${tanggalPanjang(dari)} sampai ${tanggalPanjang(sampai)}.`
                    : "Kosongkan salah satu tanggal kalau ingin batas terbuka."}
              </p>
            </Card>
          </div>

          {/* Kolom kanan: ringkasan + tombol unduh */}
          <Card className="lg:sticky lg:top-4">
            <div className="mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Isi file</h2>
            </div>

            {pilihan.length === 0 ? (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Pilih rekening dulu untuk melihat ringkasannya.
              </p>
            ) : menghitung ? (
              <Skeleton baris={3} />
            ) : (
              <>
                <ul className="divide-y divide-gray-200 dark:divide-zinc-700">
                  {pilihan.map((id) => {
                    const r = rekening.find((x) => x.id === id);
                    const k = ringkas?.find((x) => x.id === id);
                    if (!r) return null;
                    return (
                      <li key={id} className="flex items-start justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-gray-900 dark:text-gray-50">
                            {labelRekening(r.nama, r.nomorRekening)}
                          </span>
                          <span className="block text-xs text-gray-600 dark:text-gray-400">
                            {k ? `${k.jumlah} transaksi` : "—"}
                          </span>
                        </span>
                        {k?.jumlah === 0 && (
                          <span className="shrink-0 text-xs text-amber-700 dark:text-amber-400">kosong</span>
                        )}
                      </li>
                    );
                  })}
                </ul>

                <p className="mt-3 border-t border-gray-200 pt-3 text-sm text-gray-700 dark:border-zinc-700 dark:text-gray-300">
                  Total <span className="font-semibold">{totalTransaksi}</span> transaksi dari{" "}
                  <span className="font-semibold">{pilihan.length}</span> rekening.
                </p>
              </>
            )}

            <Button
              className="mt-4 w-full"
              onClick={unduh}
              loading={mengunduh}
              disabled={pilihan.length === 0 || adaRentangSalah}
            >
              <Download className="h-4 w-4" />
              Unduh Excel
            </Button>

            <p className="mt-2 break-all text-xs text-gray-600 dark:text-gray-400">
              File: {namaFilePerkiraan}
            </p>

            <div className="mt-4 flex gap-2 rounded-lg bg-gray-50 p-3 text-xs text-gray-600 dark:bg-zinc-800/60 dark:text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Baris bertanda merah muda berarti AI ragu saat membaca mutasi dan perlu dicek
                ulang sebelum dipakai.
              </span>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
