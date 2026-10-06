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
} from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  INPUT_CLASS,
  PageHeader,
} from "@/components/ui/primitives";
import { SearchableSelect, type SelectOption } from "@/components/ui/searchable-select";
import { SplitEditor, type RincianForm } from "@/components/split-editor";
import { usePasteImages } from "@/hooks/use-paste-images";
import { cn, formatAngka, formatTanggal } from "@/lib/utils";

interface BarisParsing {
  tanggalTeks: string;
  tanggalIso: string | null;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  saldoBank: number | null;
  yakin: boolean;
}

interface BarisPreview extends BarisParsing {
  kodeAkunId: string | null;
  statusKode: "KOSONG" | "SARAN_AI" | "DIKONFIRMASI";
  catatan: string;
  /** Kosong = tidak di-split */
  rincian: RincianForm[];
}

interface Rekening {
  id: string;
  nama: string;
  bank: string;
  aktif: boolean;
}

interface KodeAkun {
  id: string;
  kode: string;
  nama: string;
  aktif: boolean;
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
      } catch {
        toast.error("Gagal memuat data master");
      }
    })();
  }, []);

  const opsiRekening: SelectOption[] = rekening.map((r) => ({
    value: r.id,
    label: r.nama,
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

      if (mode === "screenshot") {
        const form = new FormData();
        gambar.forEach((f) => form.append("files", f));
        const res = await fetch("/api/parse/gambar", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        hasil = data.baris;
      } else {
        const form = new FormData();
        form.append("file", pdf!);
        form.append("password", passwordPdf);
        const res = await fetch("/api/parse/mandiri", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        hasil = data.baris;
      }

      if (hasil.length === 0) {
        toast.error("Tidak ada transaksi yang terbaca");
        return;
      }

      setTahap("Mencari kode akun...");
      let saran: { kodeAkunId: string | null; statusKode: "KOSONG" | "SARAN_AI" }[] = [];
      try {
        const res = await fetch("/api/klasifikasi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baris: hasil }),
        });
        const data = await res.json();
        if (res.ok) saran = data.hasil;
        else toast.warning(`Saran kode akun gagal: ${data.error}. Isi manual ya.`);
      } catch {
        toast.warning("Saran kode akun gagal dimuat, isi manual ya.");
      }

      setBaris(
        hasil.map((b, i) => ({
          ...b,
          kodeAkunId: saran[i]?.kodeAkunId ?? null,
          statusKode: saran[i]?.statusKode ?? "KOSONG",
          catatan: "",
          rincian: [],
        }))
      );

      const ragu = hasil.filter((b) => !b.yakin).length;
      toast.success(
        `${hasil.length} transaksi terbaca` + (ragu > 0 ? ` (${ragu} perlu dicek manual)` : "")
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal memproses");
    } finally {
      setMemproses(false);
      setTahap("");
    }
  }

  async function simpan() {
    if (!rekeningId || baris.length === 0) return;

    const tanpaTanggal = baris.filter((b) => !b.tanggalIso).length;
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
          baris: baris.map((b) => ({
            ...b,
            rincian: b.rincian.length > 0 ? b.rincian : undefined,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(
        `${data.tersimpan} transaksi tersimpan` +
          (data.dilewati > 0 ? `, ${data.dilewati} dilewati karena sudah ada` : "")
      );
      setBaris([]);
      setGambar([]);
      setPdf(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setMenyimpan(false);
    }
  }

  const belumAdaRekening = rekening.length === 0;
  const jumlahRagu = baris.filter((b) => !b.yakin).length;
  // Baris yang di-split dianggap sudah punya kode: kodenya ada di rinciannya.
  const jumlahTanpaKode = baris.filter((b) => !b.kodeAkunId && b.rincian.length === 0).length;
  const jumlahSplit = baris.filter((b) => b.rincian.length > 0).length;
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
              <div
                role="tablist"
                className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
              >
                {(
                  [
                    { key: "screenshot", label: "Screenshot" },
                    { key: "pdf", label: "PDF Mandiri" },
                  ] as { key: Mode; label: string }[]
                ).map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={mode === t.key}
                    onClick={() => {
                      setMode(t.key);
                      setBaris([]);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      mode === t.key
                        ? "bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-50"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
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
                          className="ml-2 shrink-0 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
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
                        className={`${INPUT_CLASS} pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setLihatPassword((v) => !v)}
                        aria-label={lihatPassword ? "Sembunyikan" : "Tampilkan"}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
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
          {!rekeningId && (
            <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
              Pilih rekening dulu — transaksi harus tahu masuk ke rekening mana.
            </p>
          )}
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
                {jumlahSplit > 0 && <Badge warna="biru">{jumlahSplit} di-split</Badge>}
                <Badge warna="biru">
                  <Sparkles className="mr-1 inline h-3 w-3" />
                  Kode berlabel &quot;saran&quot; belum dikonfirmasi
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button varian="sekunder" onClick={() => setBaris([])}>
                Buang hasil
              </Button>
              <Button varian="sukses" onClick={simpan} loading={menyimpan}>
                <Save className="h-4 w-4" />
                Simpan ke Rekap
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-600 dark:border-zinc-700 dark:text-gray-400">
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
                      !b.yakin && "bg-red-50 dark:bg-red-900/20"
                    )}
                  >
                    <td className="whitespace-nowrap px-2 py-2">
                      {b.tanggalIso ? (
                        <span className="text-gray-900 dark:text-gray-50">
                          {formatTanggal(b.tanggalIso)}
                        </span>
                      ) : (
                        <input
                          type="date"
                          value=""
                          onChange={(e) => ubahBaris(i, { tanggalIso: e.target.value })}
                          className={`${INPUT_CLASS} border-red-500 py-1 text-xs dark:border-red-400`}
                          title={`Tidak terbaca: "${b.tanggalTeks}"`}
                        />
                      )}
                      {!b.yakin && (
                        <span
                          title="AI tidak yakin membaca baris ini — cek gambar aslinya"
                          className="ml-1 inline-flex text-amber-600 dark:text-amber-400"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </span>
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
                              })
                            }
                            options={opsiKode}
                            placeholder="Pilih kode"
                            searchPlaceholder="Cari kode atau nama..."
                            emptyText="Kode tidak ditemukan"
                          />
                          {b.statusKode === "SARAN_AI" && (
                            <span className="mt-1 inline-block text-xs text-blue-700 dark:text-blue-300">
                              saran AI
                            </span>
                          )}
                        </>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
                      {b.uangMasuk ? formatAngka(b.uangMasuk) : ""}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-gray-900 dark:text-gray-50">
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
            ubahBaris(splitIndex, { rincian, kodeAkunId: null, statusKode: "DIKONFIRMASI" });
            setSplitIndex(null);
          }}
          onBatalkanSplit={() => {
            ubahBaris(splitIndex, { rincian: [], statusKode: "KOSONG" });
            setSplitIndex(null);
          }}
        />
      )}

      {memproses && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tahap}
        </div>
      )}
    </>
  );
}
