"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Card,
  EmptyState,
  INPUT_CLASS,
  PageHeader,
  Skeleton,
  TabButton,
  TabList,
} from "@/components/ui/primitives";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn, formatRupiah } from "@/lib/utils";
import type { BarisLaporan, HasilLaporan } from "@/lib/laporan";

type Tab = "laba-rugi" | "neraca" | "arus-kas" | "perubahan-modal";

const TABS: { key: Tab; label: string }[] = [
  { key: "laba-rugi", label: "Laba Rugi" },
  { key: "neraca", label: "Neraca" },
  { key: "arus-kas", label: "Arus Kas" },
  { key: "perubahan-modal", label: "Perubahan Modal" },
];

const PRESET = [
  { value: "tahun-ini", label: "Tahun ini" },
  { value: "kuartal-ini", label: "Kuartal ini" },
  { value: "bulan-ini", label: "Bulan ini" },
  { value: "bulan-lalu", label: "Bulan lalu" },
  { value: "semua", label: "Semua data" },
  { value: "kustom", label: "Kustom" },
];

const NAMA_BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** YYYY-MM-DD dari komponen lokal — bukan toISOString, supaya tidak geser sehari karena zona waktu. */
function iso(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function hitungPreset(kunci: string): { dari: string; sampai: string } | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const hariIni = iso(y, m, now.getDate());
  switch (kunci) {
    case "tahun-ini":
      return { dari: iso(y, 0, 1), sampai: hariIni };
    case "kuartal-ini": {
      const awal = Math.floor(m / 3) * 3;
      return { dari: iso(y, awal, 1), sampai: hariIni };
    }
    case "bulan-ini":
      return { dari: iso(y, m, 1), sampai: hariIni };
    case "bulan-lalu": {
      const akhir = new Date(y, m, 0);
      return { dari: iso(akhir.getFullYear(), akhir.getMonth(), 1), sampai: iso(akhir.getFullYear(), akhir.getMonth(), akhir.getDate()) };
    }
    case "semua":
      return { dari: "2000-01-01", sampai: hariIni };
    default:
      return null;
  }
}

function tanggalPanjang(isoStr: string) {
  const [y, m, d] = isoStr.split("-").map(Number);
  return `${d} ${NAMA_BULAN[m - 1]} ${y}`;
}

/** Negatif ditulis dalam kurung, sesuai kebiasaan laporan keuangan. */
function Nilai({ n, tebal }: { n: number; tebal?: boolean }) {
  const negatif = n < 0;
  return (
    <span
      className={cn(
        "tabular-nums",
        tebal && "font-semibold",
        negatif ? "text-red-700 dark:text-red-400" : "text-gray-900 dark:text-gray-50"
      )}
    >
      {negatif ? `(${formatRupiah(-n)})` : formatRupiah(n)}
    </span>
  );
}

function Judul({ children }: { children: React.ReactNode }) {
  return (
    <tr>
      <td
        colSpan={3}
        className="pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400"
      >
        {children}
      </td>
    </tr>
  );
}

function Garis({
  kode,
  nama,
  nilai,
  catatan,
}: {
  kode?: string;
  nama: string;
  nilai: number;
  catatan?: string;
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-zinc-800">
      <td className="w-14 whitespace-nowrap py-1.5 pr-2 font-mono text-xs text-gray-600 sm:w-20 dark:text-gray-400">
        {kode}
      </td>
      <td className="py-1.5 pr-3 text-gray-900 dark:text-gray-50">
        {nama}
        {catatan && (
          <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">{catatan}</span>
        )}
      </td>
      <td className="whitespace-nowrap py-1.5 text-right">
        <Nilai n={nilai} />
      </td>
    </tr>
  );
}

function Total({ label, nilai, kuat }: { label: string; nilai: number; kuat?: boolean }) {
  return (
    <tr className={cn(kuat ? "border-y-2" : "border-t", "border-gray-300 dark:border-zinc-600")}>
      <td colSpan={2} className="py-2 pr-3 font-semibold text-gray-900 dark:text-gray-50">
        {label}
      </td>
      <td className="whitespace-nowrap py-2 text-right">
        <Nilai n={nilai} tebal />
      </td>
    </tr>
  );
}

function Daftar({ baris }: { baris: BarisLaporan[] }) {
  return (
    <>
      {baris.map((b) => (
        <Garis key={b.kodeAkunId ?? "-"} kode={b.kode} nama={b.nama} nilai={b.nilai} />
      ))}
    </>
  );
}

function Kosong() {
  return (
    <tr>
      <td colSpan={3} className="py-2 text-sm text-gray-600 dark:text-gray-400">
        Tidak ada transaksi.
      </td>
    </tr>
  );
}

function Tabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function CatatanPersediaan({ d }: { d: HasilLaporan }) {
  const p = d.persediaan;
  const kotak = (warna: "amber" | "blue", isi: React.ReactNode, ikon: "w" | "i" = "i") => (
    <div
      className={cn(
        "mb-4 flex items-start gap-2 rounded-xl border px-4 py-2.5 text-sm",
        warna === "amber"
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
          : "border-blue-300 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
      )}
    >
      {ikon === "w" ? (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{isi}</span>
    </div>
  );

  return (
    <>
      {!p.dipakai &&
        kotak(
          "blue",
          "Laporan per rekening tidak menampilkan persediaan (stok tidak terbagi per rekening). Pilih Semua rekening atau satu brand untuk melihat persediaan dan Selisih HPP."
        )}
      {p.dipakai &&
        !p.adaAwal &&
        kotak(
          "blue",
          <>
            Persediaan belum dimasukkan, jadi Neraca belum memuat nilai stok dan belum ada Selisih HPP.{" "}
            <Link href="/stok" className="font-medium underline">
              Unggah Persediaan Awal
            </Link>
          </>
        )}
      {p.dipakai &&
        p.adaAwal &&
        !p.soMenjangkau &&
        kotak(
          "amber",
          <>
            <strong>Persediaan akhir memakai SO per {p.posisiAkhir && tanggalPanjang(p.posisiAkhir)}</strong>; belum
            ada SO untuk akhir periode ini. Selisih HPP dan laba periode belum final sampai SO berikutnya
            diunggah.{" "}
            <Link href="/stok" className="font-medium underline">
              Stok &amp; HPP
            </Link>
          </>,
          "w"
        )}
      {p.dipakai &&
        p.bentrokKode103 !== 0 &&
        kotak(
          "amber",
          <>
            <strong>Kode 103 Persediaan Barang Dagang masih berisi {formatRupiah(p.bentrokKode103)}</strong> dari
            transaksi bank, padahal persediaan sekarang dihitung dari SO. Kalau itu pembelian barang, pindahkan
            ke kode pembelian (5xx) supaya tidak terhitung dobel.{" "}
            <Link href="/transaksi" className="font-medium underline">
              Lihat transaksi
            </Link>
          </>,
          "w"
        )}
      {d.cakupan.brandId &&
        d.cakupan.rekeningTanpaBrand > 0 &&
        kotak(
          "blue",
          <>
            {d.cakupan.rekeningTanpaBrand} rekening belum diberi brand, jadi tidak masuk laporan brand ini.{" "}
            <Link href="/master/rekening" className="font-medium underline">
              Atur di Rekening
            </Link>
          </>
        )}
    </>
  );
}

function PeringatanBelumDiatur({
  baris,
  konteks,
}: {
  baris: HasilLaporan["labaRugi"]["luarLaporan"];
  konteks: string;
}) {
  const perluDiatur = baris.filter((b) => b.alasan !== "TIDAK_MASUK_LAPORAN");
  if (perluDiatur.length === 0) return null;
  const total = perluDiatur.reduce((s, b) => s + b.nilai, 0);
  const jumlahTransaksi = perluDiatur.reduce((s, b) => s + b.jumlahTransaksi, 0);

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <strong>
            {jumlahTransaksi} transaksi (net {formatRupiah(total)}) belum masuk {konteks}.
          </strong>{" "}
          Kodenya belum diatur masuk laporan apa, atau transaksinya belum diberi kode.
          <ul className="mt-1.5 list-disc pl-5 text-xs">
            {perluDiatur.slice(0, 6).map((b) => (
              <li key={b.kodeAkunId ?? "-"}>
                <span className="font-mono">{b.kode}</span> {b.nama} — {b.jumlahTransaksi} transaksi,{" "}
                {formatRupiah(b.nilai)}
              </li>
            ))}
            {perluDiatur.length > 6 && <li>dan {perluDiatur.length - 6} kode lainnya</li>}
          </ul>
          <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium underline">
            <Link href="/master/kode-akun">Atur di Kode Akun</Link>
            <Link href="/transaksi?belumBeres=1">Lihat transaksi belum beres</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Pemeriksaan silang kas: laporan vs saldo berjalan tersimpan. Ini satu-satunya
 * angka di halaman ini yang bisa berubah jadi merah kalau ada data rusak.
 */
function Pemeriksaan({ p }: { p: HasilLaporan["pemeriksaan"] }) {
  return (
    <div className="mb-4 space-y-2">
      {p.cocok ? (
        <div className="flex items-start gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-200">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Kas di laporan cocok dengan saldo berjalan tiap rekening ({formatRupiah(p.kasLaporan)}).
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Kas tidak cocok, selisih {formatRupiah(p.selisih)}.</strong> Laporan menghitung{" "}
            {formatRupiah(p.kasLaporan)}, saldo berjalan tersimpan {formatRupiah(p.kasTersimpan)}. Ada
            data yang rusak — jangan dipakai sebelum diperiksa.
          </span>
        </div>
      )}

      {p.satuRekening && (
        <div className="flex items-start gap-2 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-gray-300">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Hanya satu rekening yang dipilih. Transfer antar rekening cuma terlihat sebelah, jadi
            akun seperti Pengalihan Dana tidak akan nol dan angka Laba Rugi belum menggambarkan
            seluruh usaha. Pilih &quot;Semua rekening&quot; untuk laporan yang utuh.
          </span>
        </div>
      )}
    </div>
  );
}

function LabaRugi({ d }: { d: HasilLaporan["labaRugi"] }) {
  return (
    <>
      <PeringatanBelumDiatur baris={d.luarLaporan} konteks="Laba Rugi" />
      <Tabel>
        <Judul>Pendapatan</Judul>
        {d.pendapatan.length ? <Daftar baris={d.pendapatan} /> : <Kosong />}
        <Total label="Total Pendapatan" nilai={d.totalPendapatan} />

        <Judul>Pembelian ke vendor</Judul>
        {d.pembelian.length ? <Daftar baris={d.pembelian} /> : <Kosong />}
        <Total label="Total Pembelian" nilai={d.totalPembelian} />

        <Total label="Laba Kotor" nilai={d.labaKotor} kuat />

        <Judul>Beban</Judul>
        {d.beban.length ? <Daftar baris={d.beban} /> : <Kosong />}
        <Total label="Total Beban" nilai={d.totalBeban} />

        <Total label={d.labaBersih >= 0 ? "Laba Bersih" : "Rugi Bersih"} nilai={d.labaBersih} kuat />
      </Tabel>
      <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        Basis kas: pendapatan dan beban dicatat saat uang masuk atau keluar di rekening, bukan saat
        transaksinya terjadi. Pembelian ke vendor dihitung penuh sebagai biaya periode ini, tanpa
        memperhitungkan persediaan akhir.
      </p>
    </>
  );
}

function Neraca({ d }: { d: HasilLaporan["neraca"] }) {
  const e = d.ekuitas;
  return (
    <>
      {d.belumDiklasifikasi.baris.length > 0 && (
        <PeringatanBelumDiatur
          baris={d.belumDiklasifikasi.baris}
          konteks="Aset, Liabilitas, maupun Ekuitas"
        />
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <Tabel>
            <Judul>Aset</Judul>
            <tr>
              <td colSpan={3} className="pt-1 text-xs font-medium text-gray-700 dark:text-gray-300">
                Kas di bank
              </td>
            </tr>
            {d.kas.filter((k) => k.jenis === "BANK").length ? (
              d.kas
                .filter((k) => k.jenis === "BANK")
                .map((k) => <Garis key={k.rekeningId} nama={k.nama} nilai={k.saldo} />)
            ) : (
              <Kosong />
            )}
            <Total label="Total Kas di Bank" nilai={d.totalBank} />

            {d.kas.some((k) => k.jenis === "PETTY_CASH") && (
              <>
                <tr>
                  <td colSpan={3} className="pt-4 text-xs font-medium text-gray-700 dark:text-gray-300">
                    Petty cash (kas tunai)
                  </td>
                </tr>
                {d.kas
                  .filter((k) => k.jenis === "PETTY_CASH")
                  .map((k) => (
                    <Garis key={k.rekeningId} nama={k.nama} nilai={k.saldo} />
                  ))}
                <Total label="Total Petty Cash" nilai={d.totalPettyCash} />
              </>
            )}
            <Total label="Total Kas dan Setara Kas" nilai={d.totalKas} />

            <tr>
              <td colSpan={3} className="pt-4 text-xs font-medium text-gray-700 dark:text-gray-300">
                Aset lainnya
              </td>
            </tr>
            {d.asetLain.length ? <Daftar baris={d.asetLain} /> : <Kosong />}
            <Total label="Total Aset Lainnya" nilai={d.totalAsetLain} />

            <Total label="TOTAL ASET" nilai={d.totalAset} kuat />
          </Tabel>
        </div>

        <div>
          <Tabel>
            <Judul>Liabilitas</Judul>
            {d.liabilitas.length ? <Daftar baris={d.liabilitas} /> : <Kosong />}
            <Total label="Total Liabilitas" nilai={d.totalLiabilitas} />

            <Judul>Ekuitas</Judul>
            <Garis nama="Modal awal (saldo awal rekening)" nilai={e.saldoAwalRekening} />
            {e.persediaanAwal !== 0 && (
              <Garis nama="Modal awal (persediaan awal / harta awal)" nilai={e.persediaanAwal} />
            )}
            <Daftar baris={e.modal} />
            <Garis nama="Laba (rugi) ditahan" nilai={e.labaDitahan} />
            <Garis nama="Laba (rugi) tahun berjalan" nilai={e.labaBerjalan} />
            <Total label="Total Ekuitas" nilai={e.total} />

            {d.belumDiklasifikasi.baris.length > 0 && (
              <Garis
                nama="Belum diklasifikasi"
                nilai={d.belumDiklasifikasi.total}
                catatan="harus diatur di Kode Akun"
              />
            )}

            <Total label="TOTAL LIABILITAS + EKUITAS" nilai={d.totalPasiva} kuat />
          </Tabel>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        Per {tanggalPanjang(d.tanggal)}. Kas dan bank diambil dari saldo awal rekening ditambah seluruh
        mutasi sampai tanggal itu. Saldo awal rekening diperlakukan sebagai modal awal pembukuan.
        Kedua sisi neraca ini selalu sama besar karena setiap transaksi dicatat ke dua sisi sekaligus —
        jadi &quot;seimbang&quot; bukan bukti angkanya benar. Yang memeriksa itu kotak di atas halaman.
      </p>
    </>
  );
}

function ArusKas({ d }: { d: HasilLaporan["arusKas"] }) {
  const seksi: { judul: string; baris: BarisLaporan[]; total: number }[] = [
    { judul: "Arus kas dari aktivitas operasi", baris: d.operasi, total: d.total.operasi },
    { judul: "Arus kas dari aktivitas investasi", baris: d.investasi, total: d.total.investasi },
    { judul: "Arus kas dari aktivitas pendanaan", baris: d.pendanaan, total: d.total.pendanaan },
    { judul: "Perpindahan dana (antar rekening dan kas tunai)", baris: d.pindahDana, total: d.total.pindahDana },
  ];
  return (
    <>
      {d.belumDiklasifikasi.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <strong>
                {d.belumDiklasifikasi.length} kode akun belum diatur aktivitas arus kasnya
              </strong>{" "}
              (net {formatRupiah(d.total.belumDiklasifikasi)}). Nominalnya tampil di bagian
              &quot;Belum diklasifikasi&quot; di bawah.{" "}
              <Link href="/master/kode-akun" className="font-medium underline">
                Atur di Kode Akun
              </Link>
            </div>
          </div>
        </div>
      )}

      <Tabel>
        <Garis nama="Saldo kas awal periode" nilai={d.kasAwal} />

        {seksi.map((s) => (
          <React.Fragment key={s.judul}>
            <Judul>{s.judul}</Judul>
            {s.baris.length ? <Daftar baris={s.baris} /> : <Kosong />}
            <Total label="Arus kas bersih" nilai={s.total} />
          </React.Fragment>
        ))}

        {d.belumDiklasifikasi.length > 0 && (
          <>
            <Judul>Belum diklasifikasi</Judul>
            <Daftar baris={d.belumDiklasifikasi} />
            <Total label="Arus kas bersih" nilai={d.total.belumDiklasifikasi} />
          </>
        )}

        <tr>
          <td colSpan={3} className="pt-4"></td>
        </tr>
        <Total label="Kenaikan (penurunan) kas bersih" nilai={d.kenaikan} kuat />
        <Total label="Saldo kas akhir periode" nilai={d.kasAkhir} kuat />
      </Tabel>
      <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        Metode langsung, tiap baris adalah uang masuk dikurangi uang keluar pada kode akun itu.
        &quot;Perpindahan dana&quot; (transfer antar rekening, tarik tunai) bukan arus kas usaha. Saldo
        kas akhir sama dengan total saldo rekening di Neraca.
      </p>
    </>
  );
}

function PerubahanModal({ d }: { d: HasilLaporan["perubahanModal"] }) {
  return (
    <>
      <Tabel>
        <Judul>Modal awal periode</Judul>
        <Garis nama="Saldo awal rekening" nilai={d.awal.saldoAwalRekening} />
        {d.awal.persediaanAwal !== 0 && (
          <Garis nama="Persediaan awal (harta awal)" nilai={d.awal.persediaanAwal} />
        )}
        <Garis nama="Modal dan prive periode sebelumnya" nilai={d.awal.modalDanPriveSebelumnya} />
        <Garis nama="Laba (rugi) periode sebelumnya" nilai={d.awal.labaSebelumnya} />
        <Total label="Modal awal" nilai={d.awal.total} />

        <Judul>Perubahan selama periode</Judul>
        {d.mutasiModal.length ? (
          d.mutasiModal.map((b) => (
            <Garis
              key={b.kodeAkunId ?? "-"}
              kode={b.kode}
              nama={b.nama}
              nilai={b.nilai}
              catatan={b.nilai >= 0 ? "penambahan" : "pengurangan"}
            />
          ))
        ) : (
          <Kosong />
        )}
        <Garis nama="Laba (rugi) bersih periode" nilai={d.labaPeriode} />
        <Total label="Total perubahan" nilai={d.totalMutasiModal + d.labaPeriode} />

        <tr>
          <td colSpan={3} className="pt-4"></td>
        </tr>
        <Total label="Modal akhir" nilai={d.akhir} kuat />
      </Tabel>

      <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">
        Modal akhir sama dengan Total Ekuitas di Neraca ({formatRupiah(d.ekuitasNeraca)}). Keduanya
        dihitung dari komponen yang sama, jadi memang selalu sama — ini keterangan, bukan pemeriksaan.
      </p>
    </>
  );
}

export default function LaporanPage() {
  const awal = hitungPreset("tahun-ini")!;
  const [tab, setTab] = React.useState<Tab>("laba-rugi");
  const [preset, setPreset] = React.useState<string | null>("tahun-ini");
  const [dari, setDari] = React.useState(awal.dari);
  const [sampai, setSampai] = React.useState(awal.sampai);
  const [rekeningId, setRekeningId] = React.useState<string | null>(null);
  const [brandId, setBrandId] = React.useState<string | null>(null);
  const [daftarBrand, setDaftarBrand] = React.useState<{ id: string; nama: string }[]>([]);
  const [data, setData] = React.useState<HasilLaporan | null>(null);
  const [daftarRekening, setDaftarRekening] = React.useState<{ id: string; nama: string }[]>([]);
  const [memuat, setMemuat] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/rekening");
        const json = await res.json();
        if (res.ok) setDaftarRekening(json.rekening);
        const rb = await fetch("/api/brand");
        if (rb.ok) setDaftarBrand((await rb.json()).brand);
      } catch {
        /* dropdown rekening tetap kosong, laporan semua rekening tetap jalan */
      }
    })();
  }, []);

  const muat = React.useCallback(async () => {
    if (!dari || !sampai) return;
    setMemuat(true);
    setError(null);
    try {
      const q = new URLSearchParams({ dari, sampai });
      if (rekeningId) q.set("rekeningId", rekeningId);
      else if (brandId) q.set("brandId", brandId);
      const res = await fetch(`/api/laporan?${q}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (err) {
      const pesan = err instanceof Error ? err.message : "Gagal memuat laporan";
      setError(pesan);
      toast.error(pesan);
    } finally {
      setMemuat(false);
    }
  }, [dari, sampai, rekeningId, brandId]);

  React.useEffect(() => {
    muat();
  }, [muat]);

  function pilihPreset(v: string | null) {
    setPreset(v);
    const hasil = v ? hitungPreset(v) : null;
    if (hasil) {
      setDari(hasil.dari);
      setSampai(hasil.sampai);
    }
  }

  const adaTransaksi = (data?.jumlahTransaksiPeriode ?? 0) > 0;

  return (
    <>
      <PageHeader
        judul="Laporan"
        deskripsi="Laba Rugi, Neraca, Arus Kas, dan Perubahan Modal, dihitung dari transaksi dan kode akun yang tersimpan."
      />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchableSelect
            label="Periode"
            value={preset}
            onChange={pilihPreset}
            options={PRESET}
            placeholder="Kustom"
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
                setPreset("kustom");
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
                setPreset("kustom");
              }}
              className={INPUT_CLASS}
            />
          </div>
          <SearchableSelect
            label="Brand"
            value={brandId}
            onChange={(v) => {
              setBrandId(v);
              if (v) setRekeningId(null);
            }}
            options={daftarBrand.map((b) => ({ value: b.id, label: b.nama }))}
            placeholder="Semua brand"
            emptyText="Belum ada brand"
          />
          <SearchableSelect
            label="Rekening"
            value={rekeningId}
            onChange={(v) => {
              setRekeningId(v);
              if (v) setBrandId(null);
            }}
            options={daftarRekening.map((r) => ({ value: r.id, label: r.nama }))}
            placeholder="Semua rekening"
            emptyText="Belum ada rekening"
          />
        </div>
      </Card>

      <TabList label="Jenis laporan" className="mb-4">
        {TABS.map((t) => (
          <TabButton key={t.key} aktif={tab === t.key} onClick={() => setTab(t.key)}>
            {t.label}
          </TabButton>
        ))}
      </TabList>

      <Card>
        {memuat && !data ? (
          <Skeleton baris={10} />
        ) : error && !data ? (
          <EmptyState pesan={error} />
        ) : data ? (
          <div className={cn(memuat && "opacity-60 transition-opacity")}>
            <div className="mb-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
                {TABS.find((t) => t.key === tab)?.label}
              </h2>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                {tab === "neraca"
                  ? `Per ${tanggalPanjang(data.periode.sampai)}`
                  : `${tanggalPanjang(data.periode.dari)} sampai ${tanggalPanjang(data.periode.sampai)}`}
                {" · "}
                {rekeningId
                  ? data.rekening.find((r) => r.id === rekeningId)?.nama
                  : brandId
                    ? `Brand ${daftarBrand.find((b) => b.id === brandId)?.nama ?? ""} · ${data.rekening.length} rekening`
                    : `${data.rekening.length} rekening`}
              </p>
            </div>

            <Pemeriksaan p={data.pemeriksaan} />
            {(tab === "neraca" || tab === "laba-rugi" || tab === "perubahan-modal") && <CatatanPersediaan d={data} />}

            {data.menungguAcc > 0 && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-300 bg-blue-50 px-4 py-2.5 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  <strong>{data.menungguAcc} transaksi pada periode ini belum di-ACC.</strong>{" "}
                  Transaksinya tetap dihitung di laporan karena uangnya sudah berpindah, tapi kode
                  akunnya belum disahkan sehingga rincian per akun bisa berubah.{" "}
                  <Link href="/transaksi?menungguAcc=1" className="font-medium underline">
                    Lihat daftar
                  </Link>
                </span>
              </div>
            )}

            {tab === "neraca" || adaTransaksi ? (
              <>
                {tab === "laba-rugi" && <LabaRugi d={data.labaRugi} />}
                {tab === "neraca" && <Neraca d={data.neraca} />}
                {tab === "arus-kas" && <ArusKas d={data.arusKas} />}
                {tab === "perubahan-modal" && <PerubahanModal d={data.perubahanModal} />}
              </>
            ) : (
              <EmptyState pesan="Belum ada transaksi pada periode ini. Ubah periode atau rekening di atas." />
            )}
          </div>
        ) : null}
      </Card>
    </>
  );
}
