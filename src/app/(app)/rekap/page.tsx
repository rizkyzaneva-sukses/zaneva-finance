"use client";

import * as React from "react";
import Link from "next/link";
import {
  Upload,
  X,
  Save,
  Loader2,
  AlertTriangle,
  Sparkles,
  Eye,
  EyeOff,
  Scissors,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  INPUT_CLASS,
  Modal,
  PageHeader,
  TabButton,
  TabList,
} from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { SplitEditor, type RincianForm } from "@/components/split-editor";
import { usePasteImages } from "@/hooks/use-paste-images";
import { cn, formatAngka, formatTanggal, labelRekening } from "@/lib/utils";

interface BarisParsing {
  tanggalTeks: string;
  tanggalIso: string | null;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  saldoBank: number | null;
  yakin: boolean;
}

type AsalKode = "aturan" | "belajar" | "ai" | "kosong" | "manual";

interface SaranKode {
  kodeAkunId: string | null;
  statusKode: "KOSONG" | "SARAN_AI" | "DIKONFIRMASI";
  asal?: AsalKode;
  alasan?: string | null;
  duplikat?: "orang" | "persis" | null;
  alasanDuplikat?: string | null;
}

interface BarisPreview extends BarisParsing {
  kodeAkunId: string | null;
  statusKode: "KOSONG" | "SARAN_AI" | "DIKONFIRMASI";
  asalKode: AsalKode;
  alasanKode: string | null;
  catatan: string;
  /** Kosong = tidak di-split */
  rincian: RincianForm[];
  /** Centang untuk Ubah Sekaligus — belum menulis ke database */
  dipilih: boolean;
  duplikat: boolean;
  alasanDuplikat: string | null;
  /** Duplikat defaultnya tidak ikut disimpan */
  ikut: boolean;
}

interface Rekening {
  id: string;
  nama: string;
  bank: string;
  nomorRekening?: string | null;
  aktif: boolean;
}

interface KodeAkun {
  id: string;
  kode: string;
  nama: string;
  aktif: boolean;
}

interface Unggahan {
  kunci: string;
  jumlah: number;
  pembuat: string;
  sumber: string;
  dibuatPada: string;
  dari: string;
  sampai: string;
}

type Mode = "screenshot" | "pdf";

export default function RekapPage() {
  const [rekening, setRekening] = React.useState<Rekening[]>([]);
  const [kodeAkun, setKodeAkun] = React.useState<KodeAkun[]>([]);
  const [rekeningId, setRekeningId] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<Mode>("screenshot");

  const [gambar, setGambar] = React.useState<File[]>([]);
  const [pdf, setPdf] = React.useState<File | null>(null);
  const [passwordPdf, setPasswordPdf] = React.useState("02071993");
  const [lihatPassword, setLihatPassword] = React.useState(false);

  const [baris, setBaris] = React.useState<BarisPreview[]>([]);
  const [memproses, setMemproses] = React.useState(false);
  const [tahap, setTahap] = React.useState("");
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [splitIndex, setSplitIndex] = React.useState<number | null>(null);
  const [ubahKode, setUbahKode] = React.useState(false);
  const [kodeTujuan, setKodeTujuan] = React.useState<string | null>(null);
  const [isiTanggal, setIsiTanggal] = React.useState(false);
  const [tanggalTujuan, setTanggalTujuan] = React.useState("");
  const [role, setRole] = React.useState<string | null>(null);
  const [unggahan, setUnggahan] = React.useState<Unggahan[]>([]);
  const [versiUnggahan, setVersiUnggahan] = React.useState(0);
  const [pindahKunci, setPindahKunci] = React.useState<string | null>(null);
  const [balikKunci, setBalikKunci] = React.useState<string | null>(null);
  const [rekeningTujuan, setRekeningTujuan] = React.useState<string | null>(null);
  const [memindah, setMemindah] = React.useState(false);

  const inputGambar = React.useRef<HTMLInputElement>(null);
  const inputPdf = React.useRef<HTMLInputElement>(null);

  usePasteImages((files) => {
    if (mode === "screenshot") setGambar((prev) => [...prev, ...files]);
  });

  React.useEffect(() => {
    (async () => {
      try {
        const [r1, r2] = await Promise.all([fetch("/api/rekening"), fetch("/api/kode-akun?aktif=1")]);
        const [d1, d2] = await Promise.all([r1.json(), r2.json()]);
        if (r1.ok) setRekening(d1.rekening.filter((r: Rekening) => r.aktif));
        if (r2.ok) setKodeAkun(d2.kodeAkun);
        const saya = await fetch("/api/auth/me");
        if (saya.ok) setRole((await saya.json()).user.role);
      } catch {
        toast.error("Gagal memuat data master");
      }
    })();
  }, []);

  React.useEffect(() => {
    if (!rekeningId) {
      setUnggahan([]);
      return;
    }
    let batal = false;
    (async () => {
      try {
        const res = await fetch(`/api/transaksi/unggahan?rekeningId=${rekeningId}`);
        const data = await res.json();
        if (!batal && res.ok) setUnggahan(data.unggahan ?? []);
      } catch {
        if (!batal) setUnggahan([]);
      }
    })();
    return () => {
      batal = true;
    };
  }, [rekeningId, versiUnggahan]);

  const opsiRekening: SelectOption[] = rekening.map((r) => ({
    value: r.id,
    label: labelRekening(r.nama, r.nomorRekening),
    hint: r.bank,
  }));

  const opsiKode: SelectOption[] = React.useMemo(
    () => kodeAkun.map((k) => ({ value: k.id, label: `${k.kode} — ${k.nama}`, hint: k.kode })),
    [kodeAkun]
  );

  function ubahBaris(index: number, patch: Partial<BarisPreview>) {
    setBaris((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  }

  async function proses() {
    if (!rekeningId) {
      toast.error("Pilih rekening dulu sebelum upload");
      return;
    }
    if (mode === "screenshot" && gambar.length === 0) {
      toast.error("Pilih minimal satu screenshot mutasi");
      return;
    }
    if (mode === "pdf" && !pdf) {
      toast.error("Pilih file PDF e-Statement dulu");
      return;
    }

    setMemproses(true);
    try {
      setTahap("Membaca mutasi...");
      let hasil: BarisParsing[];
      let dibalikArah = 0;

      if (mode === "screenshot") {
        const form = new FormData();
        gambar.forEach((f) => form.append("files", f));
        const res = await fetch("/api/parse/gambar", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        hasil = data.baris;
        dibalikArah = Number(data.dibalikArah) || 0;
      } else {
        const form = new FormData();
        form.append("file", pdf!);
        form.append("password", passwordPdf);
        const res = await fetch("/api/parse/mandiri", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        hasil = data.baris;
        dibalikArah = Number(data.dibalikArah) || 0;
      }

      if (hasil.length === 0) {
        toast.error("Tidak ada transaksi yang terbaca");
        return;
      }

      setTahap("Mencari kode akun...");
      let saran: SaranKode[] = [];
      try {
        const res = await fetch("/api/klasifikasi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rekeningId, baris: hasil }),
        });
        const data = await res.json();
        if (res.ok) {
          saran = data.hasil;
          if (data.peringatan) toast.warning(data.peringatan);
        } else toast.warning(`Saran kode akun gagal: ${data.error}. Isi manual ya.`);
      } catch {
        toast.warning("Saran kode akun gagal dimuat, isi manual ya.");
      }

      setBaris(
        hasil.map((b, i) => {
          const duplikat = Boolean(saran[i]?.duplikat);
          return {
            ...b,
            kodeAkunId: saran[i]?.kodeAkunId ?? null,
            statusKode: saran[i]?.statusKode ?? "KOSONG",
            asalKode: saran[i]?.asal ?? "kosong",
            alasanKode: saran[i]?.alasan ?? null,
            catatan: "",
            rincian: [],
            dipilih: false,
            duplikat,
            alasanDuplikat: saran[i]?.alasanDuplikat ?? null,
            ikut: !duplikat,
          };
        })
      );

      const ragu = hasil.filter((b) => !b.yakin).length;
      const dup = saran.filter((s) => s?.duplikat).length;
      if (dibalikArah > 0) {
        toast.info(
          `${dibalikArah} baris kolomnya disesuaikan: CR dan KR OTOMATIS jadi uang masuk, DB dan tarikan ATM jadi uang keluar.`
        );
      }
      toast.success(
        `${hasil.length} transaksi terbaca` +
          (ragu > 0 ? ` (${ragu} perlu dicek manual)` : "") +
          (dup > 0 ? `. ${dup} duplikat tidak ikut sampai dijadikan unik` : "")
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses");
    } finally {
      setMemproses(false);
      setTahap("");
    }
  }

  function kunciBaris(b: { tanggalIso: string | null; keterangan: string; uangMasuk: number; uangKeluar: number }) {
    return `${b.tanggalIso}|${b.keterangan}|${b.uangMasuk || b.uangKeluar}`;
  }

  async function simpan() {
    if (!rekeningId || baris.length === 0) return;
    const akan = baris.filter((b) => b.ikut);
    if (akan.length === 0) {
      toast.error("Tidak ada yang ikut disimpan. Duplikat baru masuk kalau kamu klik Jadikan unik.");
      return;
    }

    const tanpaTanggal = akan.filter((b) => !b.tanggalIso).length;
    if (tanpaTanggal > 0) {
      toast.error(`${tanpaTanggal} baris tanggalnya belum terisi. Perbaiki dulu.`);
      return;
    }

    setMenyimpan(true);
    try {
      const res = await fetch("/api/transaksi/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rekeningId,
          sumber: mode === "pdf" ? "PDF" : "SCREENSHOT",
          baris: akan.map((b) => ({
            tanggalIso: b.tanggalIso,
            keterangan: b.keterangan,
            uangMasuk: b.uangMasuk,
            uangKeluar: b.uangKeluar,
            saldoBank: b.saldoBank,
            kodeAkunId: b.rincian.length > 0 ? null : b.kodeAkunId,
            statusKode: b.statusKode,
            catatan: b.catatan,
            yakin: b.yakin,
            paksa: b.duplikat,
            rincian: b.rincian.length > 0 ? b.rincian : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const dilewati = new Set(
        (data.barisDilewati as { tanggalTeks: string; keterangan: string; nominal: number }[]).map(
          (d) => `${d.tanggalTeks}|${d.keterangan}|${d.nominal}`
        )
      );
      const sisaDup = baris.filter((b) => !b.ikut).length;
      const berikutnya = baris
        .filter((b) => !b.ikut || dilewati.has(kunciBaris(b)))
        .map((b) =>
          dilewati.has(kunciBaris(b))
            ? {
                ...b,
                duplikat: true,
                ikut: false,
                alasanDuplikat: b.alasanDuplikat ?? "Transaksi yang sama sudah ada",
              }
            : b
        );
      setBaris(berikutnya);
      if (berikutnya.length === 0) {
        setGambar([]);
        setPdf(null);
      }

      setVersiUnggahan((v) => v + 1);
      if (data.dilewati > 0) {
        toast.warning(`${data.tersimpan} tersimpan, ${data.dilewati} duplikat tidak ikut.`);
      } else if (sisaDup > 0) {
        toast.success(`${data.tersimpan} tersimpan. ${sisaDup} duplikat tidak ikut.`);
      } else {
        toast.success(`${data.tersimpan} transaksi tersimpan`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  function terapkanKodeSekaligus() {
    if (!kodeTujuan) {
      toast.error("Pilih kode tujuan dulu");
      return;
    }
    const jumlah = baris.filter((b) => b.dipilih).length;
    if (jumlah === 0) return;
    setBaris((prev) =>
      prev.map((b) =>
        b.dipilih
          ? {
              ...b,
              kodeAkunId: kodeTujuan,
              statusKode: "DIKONFIRMASI",
              asalKode: "manual",
              rincian: [],
              dipilih: false,
            }
          : b
      )
    );
    setUbahKode(false);
    setKodeTujuan(null);
    toast.success(`${jumlah} transaksi diubah di preview. Belum tersimpan — klik Simpan Semua.`);
  }

  function balikPreview(indeks: number[]) {
    const sasaran = new Set(indeks);
    if (sasaran.size === 0) return;
    setBaris((prev) =>
      prev.map((b, i) => (sasaran.has(i) ? { ...b, uangMasuk: b.uangKeluar, uangKeluar: b.uangMasuk } : b))
    );
    toast.success(`${sasaran.size} baris dibalik arahnya. Belum tersimpan — klik Simpan Semua.`);
  }

  function terapkanTanggal() {
    if (!tanggalTujuan) {
      toast.error("Pilih tanggal dulu");
      return;
    }
    const jumlah = baris.filter((b) => b.dipilih).length;
    if (jumlah === 0) return;
    setBaris((prev) => prev.map((b) => (b.dipilih ? { ...b, tanggalIso: tanggalTujuan, dipilih: false } : b)));
    setIsiTanggal(false);
    setTanggalTujuan("");
    toast.success(`Tanggal ${jumlah} baris diisi. Belum tersimpan — klik Simpan Semua.`);
  }

  async function pindahkanUnggahan() {
    if (!rekeningId || !pindahKunci || !rekeningTujuan) return;
    setMemindah(true);
    try {
      const res = await fetch("/api/transaksi/unggahan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aksi: "pindah",
          kunci: pindahKunci,
          rekeningAsalId: rekeningId,
          rekeningTujuanId: rekeningTujuan,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.jumlah} transaksi dipindah ke ${data.tujuan}`);
      setPindahKunci(null);
      setRekeningTujuan(null);
      setVersiUnggahan((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memindahkan");
    } finally {
      setMemindah(false);
    }
  }

  async function balikUnggahan(kunci: string) {
    if (!rekeningId) return;
    setMemindah(true);
    try {
      const res = await fetch("/api/transaksi/unggahan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: "balik", kunci, rekeningAsalId: rekeningId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.diubah} transaksi dibalik arahnya`);
      setVersiUnggahan((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal membalik arah");
    } finally {
      setMemindah(false);
    }
  }

  const belumAdaRekening = rekening.length === 0;
  const jumlahRagu = baris.filter((b) => !b.yakin).length;
  // Baris yang di-split dianggap sudah punya kode: kodenya ada di rinciannya.
  const jumlahTanpaKode = baris.filter((b) => !b.kodeAkunId && b.rincian.length === 0).length;
  const jumlahSplit = baris.filter((b) => b.rincian.length > 0).length;
  const jumlahDipilih = baris.filter((b) => b.dipilih).length;
  const jumlahIkut = baris.filter((b) => b.ikut).length;
  const jumlahDuplikat = baris.filter((b) => b.duplikat).length;
  const jumlahTanpaTanggal = baris.filter((b) => !b.tanggalIso).length;
  const semuaDipilih = baris.length > 0 && jumlahDipilih === baris.length;
  const finance = role === "ADMIN" || role === "OWNER";
  const indeksDipilih = baris.flatMap((b, i) => (b.dipilih ? [i] : []));
  const indeks400Keluar = baris.flatMap((b, i) =>
    kodeAkun.find((k) => k.id === b.kodeAkunId)?.kode === "400" && b.uangKeluar > 0 && !(b.uangMasuk > 0) ? [i] : []
  );
  const barisSplit = splitIndex !== null ? baris[splitIndex] : null;

  return (
    <>
      <PageHeader
        judul="Rekap"
        deskripsi="Upload mutasi, AI membacanya dan menyarankan kode akun, kamu yang mengoreksi sebelum disimpan."
      />

      {belumAdaRekening ? (
        <Card>
          <EmptyState
            pesan="Belum ada rekening aktif. Tambahkan rekening dulu sebelum bisa merekap."
            aksi={
              <Link href="/master/rekening">
                <Button>Ke halaman Rekening</Button>
              </Link>
            }
          />
        </Card>
      ) : (
        <Card className="mb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchableSelect
              label="Rekening"
              required
              value={rekeningId}
              onChange={(v) => {
                setRekeningId(v);
                setBaris([]);
              }}
              options={opsiRekening}
              placeholder="Pilih rekening dulu"
              searchPlaceholder="Cari rekening..."
            />

            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Sumber data
              </label>
              <TabList label="Sumber data">
                {(
                  [
                    { key: "screenshot", label: "Screenshot" },
                    { key: "pdf", label: "PDF Mandiri" },
                  ] as { key: Mode; label: string }[]
                ).map((t) => (
                  <TabButton
                    key={t.key}
                    aktif={mode === t.key}
                    onClick={() => {
                      setMode(t.key);
                      setBaris([]);
                    }}
                  >
                    {t.label}
                  </TabButton>
                ))}
              </TabList>
            </div>
          </div>

          <div className="mt-4">
            {mode === "screenshot" ? (
              <>
                <div
                  onClick={() => inputGambar.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    setGambar((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                >
                  <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Klik, drag &amp; drop, atau paste (Ctrl+V) screenshot mutasi
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Bank apa pun — BCA, Mandiri, BRI, BNI. Maks 10 file, 10MB per file.
                  </p>
                  <input
                    ref={inputGambar}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => setGambar((prev) => [...prev, ...Array.from(e.target.files ?? [])])}
                  />
                </div>

                {gambar.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {gambar.map((f, i) => (
                      <li
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-1.5 text-sm dark:border-zinc-700"
                      >
                        <span className="truncate text-gray-700 dark:text-gray-300">{f.name}</span>
                        <button
                          type="button"
                          aria-label={`Hapus ${f.name}`}
                          onClick={() => setGambar((prev) => prev.filter((_, j) => j !== i))}
                          className="ml-2 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div
                  onClick={() => inputPdf.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) setPdf(f);
                  }}
                  className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center transition-colors hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800/50 dark:hover:bg-zinc-800"
                >
                  <Upload className="h-6 w-6 text-gray-500 dark:text-gray-400" />
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {pdf ? pdf.name : "Klik atau drag & drop PDF e-Statement Mandiri"}
                  </p>
                  <input
                    ref={inputPdf}
                    type="file"
                    accept="application/pdf,.pdf"
                    className="hidden"
                    onChange={(e) => setPdf(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div>
                  <Field label="Password PDF" hint="Hanya Mandiri yang punya parser PDF untuk sekarang">
                    <div className="relative">
                      <input
                        type={lihatPassword ? "text" : "password"}
                        value={passwordPdf}
                        onChange={(e) => setPasswordPdf(e.target.value)}
                        className={`${INPUT_CLASS} pr-12`}
                      />
                      <button
                        type="button"
                        onClick={() => setLihatPassword((v) => !v)}
                        aria-label={lihatPassword ? "Sembunyikan" : "Tampilkan"}
                        className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-gray-500 dark:text-gray-400"
                      >
                        {lihatPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </Field>
                </div>
              </div>
            )}
          </div>

          <Button className="mt-4" onClick={proses} loading={memproses} disabled={!rekeningId}>
            {memproses ? tahap || "Memproses..." : "Proses"}
          </Button>
          <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            File ini hanya dipakai untuk membaca mutasi, tidak disimpan. Arsip bulanannya ada di{" "}
            <Link href="/dokumen" className="font-medium text-blue-800 underline dark:text-blue-300">
              Dokumen
            </Link>
            .
          </p>
          {!rekeningId && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Pilih rekening dulu — transaksi harus tahu masuk ke rekening mana.
            </p>
          )}
        </Card>
      )}

      {rekeningId && unggahan.length > 0 && (
        <Card className="mb-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">Riwayat unggahan rekening ini</h2>
          <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
            Salah pilih rekening saat Simpan Semua? Pindahkan satu unggahan sekaligus. Saldo kedua rekening dihitung
            ulang. Yang memindahkan harus Finance.
          </p>
          <ul className="mt-3 divide-y divide-gray-100 dark:divide-zinc-800">
            {unggahan.map((u) => (
              <li key={u.kunci} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 text-sm text-gray-900 dark:text-gray-50">
                  <span className="font-medium">{u.jumlah} transaksi</span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {" "}
                    · disimpan{" "}
                    {new Date(u.dibuatPada).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" "}
                    · mutasi {formatTanggal(u.dari)}
                    {u.dari.slice(0, 10) !== u.sampai.slice(0, 10) ? `–${formatTanggal(u.sampai)}` : ""} · {u.pembuat}
                  </span>
                </div>
                {finance && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      varian="sekunder"
                      disabled={memindah}
                      onClick={() => {
                        setRekeningTujuan(null);
                        setPindahKunci(u.kunci);
                      }}
                    >
                      Pindah rekening
                    </Button>
                    <Button varian="sekunder" disabled={memindah} onClick={() => setBalikKunci(u.kunci)}>
                      <ArrowLeftRight className="h-4 w-4" />
                      Balik arah
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {baris.length > 0 && (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                Preview ({baris.length} transaksi)
              </h2>
              <div className="mt-1 flex flex-wrap gap-2 text-xs">
                {jumlahRagu > 0 && <Badge warna="merah">{jumlahRagu} perlu dicek</Badge>}
                {jumlahTanpaKode > 0 && <Badge warna="kuning">{jumlahTanpaKode} belum ada kode</Badge>}
                {jumlahDuplikat > 0 && <Badge warna="kuning">{jumlahDuplikat} duplikat</Badge>}
                {jumlahTanpaTanggal > 0 && <Badge warna="merah">{jumlahTanpaTanggal} tanpa tanggal</Badge>}
                {jumlahSplit > 0 && <Badge warna="biru">{jumlahSplit} di-split</Badge>}
                <Badge warna="biru">
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  Kode berlabel &quot;saran&quot; belum dikonfirmasi
                </Badge>
              </div>
              <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400">
                Kode boleh dikosongkan dan dilengkapi nanti; transaksi tetap dapat disimpan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                varian="sekunder"
                disabled={jumlahDipilih === 0}
                onClick={() => {
                  setKodeTujuan(null);
                  setUbahKode(true);
                }}
              >
                Ubah Sekaligus{jumlahDipilih > 0 ? ` (${jumlahDipilih})` : ""}
              </Button>
              <Button varian="sekunder" disabled={jumlahDipilih === 0} onClick={() => balikPreview(indeksDipilih)}>
                <ArrowLeftRight className="h-4 w-4" />
                Balik arah{jumlahDipilih > 0 ? ` (${jumlahDipilih})` : ""}
              </Button>
              <Button
                varian="sekunder"
                disabled={jumlahDipilih === 0}
                onClick={() => {
                  setTanggalTujuan("");
                  setIsiTanggal(true);
                }}
              >
                Isi tanggal{jumlahDipilih > 0 ? ` (${jumlahDipilih})` : ""}
              </Button>
              <Button varian="sekunder" onClick={() => setBaris([])}>
                Buang hasil
              </Button>
              <Button varian="sukses" onClick={simpan} loading={menyimpan}>
                <Save className="h-4 w-4" />
                Simpan Semua ({jumlahIkut})
              </Button>
            </div>
          </div>

          {indeks400Keluar.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100">
              <span>
                <strong>{indeks400Keluar.length} baris berkode 400</strong> ada di kolom Keluar. Kode 400 adalah
                penjualan, jadi uangnya harus masuk.
              </span>
              <Button type="button" varian="sekunder" onClick={() => balikPreview(indeks400Keluar)}>
                <ArrowLeftRight className="h-4 w-4" />
                Pindahkan ke Masuk
              </Button>
            </div>
          )}

          {jumlahDuplikat > 0 && (
            <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Baris bertanda <strong>Duplikat</strong> tidak ikut disimpan. Kalau itu memang transaksi lain
                yang kebetulan sama hari, nama, dan nominalnya, klik <strong>Jadikan unik</strong>.
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
                  <th className="w-10 px-2 py-2">
                    <input
                      type="checkbox"
                      checked={semuaDipilih}
                      onChange={(e) =>
                        setBaris((prev) => prev.map((b) => ({ ...b, dipilih: e.target.checked })))
                      }
                      aria-label="Pilih semua untuk ubah kode"
                      className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                    />
                  </th>
                  <th className="whitespace-nowrap px-2 py-2 font-medium">Tanggal</th>
                  <th className="min-w-56 px-2 py-2 font-medium">Keterangan</th>
                  <th className="min-w-52 px-2 py-2 font-medium">Kode akun</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Masuk</th>
                  <th className="whitespace-nowrap px-2 py-2 text-right font-medium">Keluar</th>
                  <th className="min-w-40 px-2 py-2 font-medium">Catatan</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {baris.map((b, i) => (
                  <React.Fragment key={i}>
                  <tr
                    className={cn(
                      "border-b border-gray-100 align-top dark:border-zinc-800",
                      !b.yakin && "bg-red-50 dark:bg-red-900/20",
                      b.duplikat && !b.ikut && "bg-amber-50 dark:bg-amber-950/30",
                      b.duplikat && b.ikut && "bg-amber-50/70 dark:bg-amber-950/20"
                    )}
                  >
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        checked={b.dipilih}
                        onChange={(e) => ubahBaris(i, { dipilih: e.target.checked })}
                        aria-label="Pilih untuk ubah kode sekaligus"
                        className="h-4 w-4 rounded border-gray-300 dark:border-zinc-600"
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <input
                        type="date"
                        value={b.tanggalIso ?? ""}
                        onChange={(e) => ubahBaris(i, { tanggalIso: e.target.value || null })}
                        className={cn(
                          INPUT_CLASS,
                          "w-36 py-1 text-xs",
                          !b.tanggalIso && "border-red-500 dark:border-red-400"
                        )}
                        title={b.tanggalIso ? "Ubah tanggal" : `Tidak terbaca: "${b.tanggalTeks}"`}
                      />
                      {!b.yakin && (
                        <span
                          title="AI tidak yakin membaca baris ini — cek gambar aslinya"
                          className="ml-1 inline-flex text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
                      )}
                      {b.duplikat && (
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span title={b.alasanDuplikat ?? "Hari, nama, dan nominal sama dengan transaksi lain"}>
                            <Badge warna="kuning">Duplikat</Badge>
                          </span>
                          {b.ikut ? (
                            <button
                              type="button"
                              onClick={() => ubahBaris(i, { ikut: false })}
                              className="text-xs font-medium text-gray-700 underline dark:text-gray-300"
                            >
                              Batalkan
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => ubahBaris(i, { ikut: true })}
                              className="rounded-md bg-amber-600 px-2 py-1 text-xs font-medium text-white hover:bg-amber-700"
                            >
                              Jadikan unik
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 text-gray-900 dark:text-gray-50">{b.keterangan}</td>
                    <td className="px-2 py-2">
                      {b.rincian.length > 0 ? (
                        <Badge warna="biru">
                          <Scissors className="mr-1 inline h-3 w-3" />
                          Di-split ({b.rincian.length} rincian)
                        </Badge>
                      ) : (
                        <>
                          <SearchableSelect
                            compact
                            value={b.kodeAkunId}
                            onChange={(v) =>
                              ubahBaris(i, {
                                kodeAkunId: v,
                                statusKode: v ? "DIKONFIRMASI" : "KOSONG",
                                asalKode: "manual",
                              })
                            }
                            options={opsiKode}
                            placeholder="Pilih kode"
                            searchPlaceholder="Cari kode atau nama..."
                            emptyText="Kode tidak ditemukan"
                          />
                          {b.asalKode === "ai" && b.statusKode === "SARAN_AI" && (
                            <span className="mt-1 inline-block text-xs text-blue-800 dark:text-blue-300">
                              saran AI
                            </span>
                          )}
                          {b.asalKode === "aturan" && (
                            <span
                              className="mt-1 inline-block text-xs text-blue-800 dark:text-blue-300"
                              title={b.alasanKode ?? undefined}
                            >
                              saran otomatis{b.alasanKode ? ` · ${b.alasanKode}` : ""}
                            </span>
                          )}
                          {b.asalKode === "belajar" && (
                            <span className="mt-1 inline-block text-xs text-emerald-800 dark:text-emerald-300">
                              dari koreksi sebelumnya
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                      {b.uangMasuk ? formatAngka(b.uangMasuk) : ""}
                    </td>
                    <td
                      className={cn(
                        "whitespace-nowrap px-2 py-2 text-right tabular-nums",
                        kodeAkun.find((k) => k.id === b.kodeAkunId)?.kode === "400" && b.uangKeluar > 0
                          ? "bg-red-50 font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200"
                          : "text-gray-900 dark:text-gray-50"
                      )}
                      title={
                        kodeAkun.find((k) => k.id === b.kodeAkunId)?.kode === "400" && b.uangKeluar > 0
                          ? "Kode 400 adalah uang masuk. Balik arahnya kalau ini salah kolom."
                          : undefined
                      }
                    >
                      {b.uangKeluar ? formatAngka(b.uangKeluar) : ""}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={b.catatan}
                        onChange={(e) => ubahBaris(i, { catatan: e.target.value })}
                        placeholder="Opsional"
                        className={`${INPUT_CLASS} py-1 text-xs`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          title="Balik masuk ↔ keluar"
                          aria-label="Balik masuk dan keluar"
                          onClick={() => balikPreview([i])}
                          className="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          title={b.rincian.length > 0 ? "Ubah split" : "Split transaksi ini"}
                          aria-label={b.rincian.length > 0 ? "Ubah split" : "Split transaksi ini"}
                          onClick={() => setSplitIndex(i)}
                          className={cn(
                            "rounded p-1 hover:bg-gray-100 dark:hover:bg-zinc-700",
                            b.rincian.length > 0
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-500 dark:text-gray-400"
                          )}
                        >
                          <Scissors className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Hapus baris"
                          onClick={() => setBaris((prev) => prev.filter((_, j) => j !== i))}
                          className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {b.rincian.map((r, k) => {
                    const kode = kodeAkun.find((x) => x.id === r.kodeAkunId);
                    return (
                      <tr
                        key={`${i}-r${k}`}
                        className="border-b border-gray-100 bg-gray-50 dark:border-zinc-800 dark:bg-zinc-800/40"
                      >
                        <td className="px-2 py-1.5"></td>
                        <td className="px-2 py-1.5"></td>
                        <td className="px-2 py-1.5 pl-6 text-xs text-gray-600 dark:text-gray-400">
                          ↳ {r.keterangan || kode?.nama}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-gray-900 dark:text-gray-50">
                          <span className="font-mono">{kode?.kode}</span> — {kode?.nama}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 dark:text-gray-50">
                          {b.uangMasuk ? formatAngka(Number(r.nominal)) : ""}
                        </td>
                        <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs tabular-nums text-gray-900 dark:text-gray-50">
                          {b.uangKeluar ? formatAngka(Number(r.nominal)) : ""}
                        </td>
                        <td colSpan={2}></td>
                      </tr>
                    );
                  })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {splitIndex !== null && barisSplit && (
        <SplitEditor
          total={barisSplit.uangMasuk || barisSplit.uangKeluar}
          arah={barisSplit.uangMasuk > 0 ? "masuk" : "keluar"}
          keteranganAsli={barisSplit.keterangan}
          opsiKode={opsiKode}
          awal={barisSplit.rincian}
          bolehBatalkan={barisSplit.rincian.length > 0}
          onTutup={() => setSplitIndex(null)}
          onSimpan={(rincian) => {
            ubahBaris(splitIndex, {
              rincian,
              kodeAkunId: null,
              statusKode: "DIKONFIRMASI",
              asalKode: "manual",
            });
            setSplitIndex(null);
          }}
          onBatalkanSplit={() => {
            ubahBaris(splitIndex, { rincian: [], statusKode: "KOSONG" });
            setSplitIndex(null);
          }}
        />
      )}

      <Modal
        buka={isiTanggal}
        judul="Isi tanggal sekaligus"
        deskripsi={`${jumlahDipilih} baris yang dicentang akan memakai tanggal ini, termasuk yang tanggalnya sudah ada. Belum tersimpan sampai Simpan Semua.`}
        onTutup={() => setIsiTanggal(false)}
      >
        <div className="grid gap-4">
          <Field label="Tanggal" required>
            <input
              type="date"
              value={tanggalTujuan}
              onChange={(e) => setTanggalTujuan(e.target.value)}
              className={INPUT_CLASS}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" varian="sekunder" onClick={() => setIsiTanggal(false)}>
              Batal
            </Button>
            <Button type="button" onClick={terapkanTanggal} disabled={!tanggalTujuan}>
              Terapkan ke preview
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        buka={pindahKunci !== null}
        judul="Pindah unggahan ke rekening lain"
        deskripsi="Semua transaksi dalam unggahan ini pindah. Saldo rekening asal dan tujuan dihitung ulang. Ini tindakan Finance."
        onTutup={() => setPindahKunci(null)}
      >
        <div className="grid gap-4">
          <SearchableSelect
            label="Rekening tujuan"
            required
            value={rekeningTujuan}
            onChange={setRekeningTujuan}
            options={opsiRekening.filter((o) => o.value !== rekeningId)}
            placeholder="Pilih rekening"
            emptyText="Tidak ada rekening lain"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" varian="sekunder" onClick={() => setPindahKunci(null)}>
              Batal
            </Button>
            <Button type="button" onClick={pindahkanUnggahan} disabled={!rekeningTujuan} loading={memindah}>
              Pindahkan
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        buka={balikKunci !== null}
        judul="Balik masuk dan keluar"
        deskripsi="Semua transaksi dalam unggahan ini ditukar kolomnya. Yang tadinya keluar jadi masuk, dan sebaliknya. Saldo dihitung ulang."
        onTutup={() => setBalikKunci(null)}
      >
        <div className="flex justify-end gap-2">
          <Button type="button" varian="sekunder" onClick={() => setBalikKunci(null)}>
            Batal
          </Button>
          <Button
            type="button"
            loading={memindah}
            onClick={async () => {
              const kunci = balikKunci;
              setBalikKunci(null);
              if (kunci) await balikUnggahan(kunci);
            }}
          >
            Balik arah
          </Button>
        </div>
      </Modal>

      <Modal
        buka={ubahKode}
        judul="Ubah kode sekaligus"
        deskripsi={`${jumlahDipilih} transaksi di preview akan memakai kode ini. Belum tersimpan ke rekap sampai kamu klik Simpan Semua.`}
        onTutup={() => setUbahKode(false)}
      >
        <div className="grid gap-4">
          <SearchableSelect
            label="Kode tujuan"
            required
            value={kodeTujuan}
            onChange={setKodeTujuan}
            options={opsiKode}
            placeholder="Pilih kode"
            searchPlaceholder="Cari kode atau nama..."
            emptyText="Kode tidak ditemukan"
          />
          <div className="flex justify-end gap-2">
            <Button type="button" varian="sekunder" onClick={() => setUbahKode(false)}>
              Batal
            </Button>
            <Button type="button" onClick={terapkanKodeSekaligus} disabled={!kodeTujuan}>
              Terapkan ke preview
            </Button>
          </div>
        </div>
      </Modal>

      {memproses && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tahap}
        </div>
      )}
    </>
  );
}
