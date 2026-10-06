import { prisma } from "@/lib/prisma";
import type { AktivitasKas, Kelompok, Laporan } from "@/generated/prisma/enums";

/**
 * Laporan keuangan basis kas, diturunkan dari mutasi bank + kode akun.
 *
 * Prinsip: tiap transaksi punya "net" = uang masuk − uang keluar (dalam sen,
 * bilangan bulat). Transaksi yang di-split dipecah jadi entri per rincian,
 * jadi induknya tidak ikut terhitung dua kali. Semua laporan dihitung dari
 * kumpulan entri yang sama, sehingga identitas akuntansi terjaga:
 *
 *   Kas + Aset lain = Saldo awal + Liabilitas + Modal + Laba + Belum diklasifikasi
 *
 * "Belum diklasifikasi" menampung transaksi tanpa kode, atau yang kodenya belum
 * diatur masuk laporan apa. Neraca tetap seimbang, dan angka itu sengaja
 * ditampilkan mencolok supaya tidak ada uang yang hilang diam-diam.
 */

type Sen = number;

interface KodeInfo {
  id: string;
  kode: string;
  nama: string;
  kelompok: Kelompok;
  laporan: Laporan | null;
  aktivitasKas: AktivitasKas | null;
}

interface Entri {
  tanggal: string; // YYYY-MM-DD
  rekeningId: string;
  kode: KodeInfo | null;
  net: Sen; // masuk − keluar
}

export interface BarisLaporan {
  kodeAkunId: string | null;
  kode: string;
  nama: string;
  nilai: number;
}

export type AlasanLuarLaporan = "TANPA_KODE" | "LAPORAN_BELUM_DIATUR" | "TIDAK_MASUK_LAPORAN";

export interface BarisLuarLaporan extends BarisLaporan {
  alasan: AlasanLuarLaporan;
  jumlahTransaksi: number;
}

const rp = (sen: Sen) => sen / 100;
const sen = (d: { mul: (n: number) => { toNumber: () => number } }): Sen =>
  Math.round(d.mul(100).toNumber());

// Urutan teks, bukan angka: kode akun bersifat hierarkis (104 → 10401 → 105), jadi
// 10401 harus tepat setelah 104, bukan setelah 900 seperti kalau diurutkan sebagai angka.
const urutKode = (a: { kode: string }, b: { kode: string }) =>
  a.kode < b.kode ? -1 : a.kode > b.kode ? 1 : 0;

type Kategori = "LR" | "NERACA" | "LUAR";

function kategori(k: KodeInfo | null): Kategori {
  if (!k) return "LUAR";
  if (k.laporan === "LABA_RUGI") return "LR";
  if (k.laporan === "NERACA") return "NERACA";
  return "LUAR";
}

function alasanLuar(k: KodeInfo | null): AlasanLuarLaporan {
  if (!k) return "TANPA_KODE";
  if (k.laporan === null) return "LAPORAN_BELUM_DIATUR";
  return "TIDAK_MASUK_LAPORAN";
}

interface Agregat {
  k: KodeInfo | null;
  net: Sen;
  n: number;
}

function agregatPerKode(entri: Entri[]): Agregat[] {
  const peta = new Map<string, Agregat>();
  for (const e of entri) {
    const kunci = e.kode?.id ?? "-";
    const now = peta.get(kunci) ?? { k: e.kode, net: 0, n: 0 };
    now.net += e.net;
    now.n += 1;
    peta.set(kunci, now);
  }
  return [...peta.values()];
}

const jumlah = (list: { nilai: number }[]) =>
  Math.round(list.reduce((s, b) => s + b.nilai * 100, 0)) / 100;

function baris(a: Agregat, nilaiSen: Sen): BarisLaporan {
  return {
    kodeAkunId: a.k?.id ?? null,
    kode: a.k?.kode ?? "(tanpa kode)",
    nama: a.k?.nama ?? "Transaksi belum diberi kode akun",
    nilai: rp(nilaiSen),
  };
}

function luarLaporan(entri: Entri[]): BarisLuarLaporan[] {
  return agregatPerKode(entri.filter((e) => kategori(e.kode) === "LUAR"))
    .map((a) => ({ ...baris(a, a.net), alasan: alasanLuar(a.k), jumlahTransaksi: a.n }))
    .sort(urutKode);
}

async function ambilEntri(sampai: string, rekeningId: string | null) {
  const [transaksi, kodeList] = await Promise.all([
    prisma.transaksi.findMany({
      where: {
        tanggal: { lte: new Date(`${sampai}T00:00:00.000Z`) },
        ...(rekeningId ? { rekeningId } : {}),
      },
      select: {
        tanggal: true,
        rekeningId: true,
        kodeAkunId: true,
        uangMasuk: true,
        uangKeluar: true,
        rincian: { select: { kodeAkunId: true, nominal: true } },
      },
    }),
    prisma.kodeAkun.findMany({
      select: { id: true, kode: true, nama: true, kelompok: true, laporan: true, aktivitasKas: true },
    }),
  ]);

  const peta = new Map<string, KodeInfo>(kodeList.map((k) => [k.id, k]));
  const entri: Entri[] = [];

  for (const t of transaksi) {
    const tanggal = t.tanggal.toISOString().slice(0, 10);
    if (t.rincian.length > 0) {
      // Rincian split yang dihitung; arah mengikuti induknya.
      const tanda = t.uangMasuk.gt(0) ? 1 : -1;
      for (const r of t.rincian) {
        entri.push({
          tanggal,
          rekeningId: t.rekeningId,
          kode: peta.get(r.kodeAkunId) ?? null,
          net: tanda * sen(r.nominal),
        });
      }
    } else {
      entri.push({
        tanggal,
        rekeningId: t.rekeningId,
        kode: t.kodeAkunId ? (peta.get(t.kodeAkunId) ?? null) : null,
        net: sen(t.uangMasuk) - sen(t.uangKeluar),
      });
    }
  }
  return entri;
}

export interface OpsiLaporan {
  dari: string;
  sampai: string;
  rekeningId: string | null;
}

export async function hitungLaporan({ dari, sampai, rekeningId }: OpsiLaporan) {
  const [entri, rekeningList] = await Promise.all([
    ambilEntri(sampai, rekeningId),
    prisma.rekening.findMany({
      where: rekeningId ? { id: rekeningId } : undefined,
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: { id: true, nama: true, saldoAwal: true },
    }),
  ]);

  const saldoAwalSen = rekeningList.reduce((s, r) => s + sen(r.saldoAwal), 0);
  const dalamPeriode = entri.filter((e) => e.tanggal >= dari && e.tanggal <= sampai);
  const sebelumPeriode = entri.filter((e) => e.tanggal < dari);
  const tahunBerjalanMulai = `${sampai.slice(0, 4)}-01-01`;

  const labaDari = (list: Entri[]) =>
    list.filter((e) => kategori(e.kode) === "LR").reduce((s, e) => s + e.net, 0);

  // ───────────── Laba Rugi (periode) ─────────────
  const pendapatan: BarisLaporan[] = [];
  const pembelian: BarisLaporan[] = [];
  const beban: BarisLaporan[] = [];
  for (const a of agregatPerKode(dalamPeriode.filter((e) => kategori(e.kode) === "LR"))) {
    // Pendapatan bertambah kalau uang masuk; semua lainnya bertambah kalau uang keluar.
    if (a.k?.kelompok === "PENDAPATAN") pendapatan.push(baris(a, a.net));
    else if (a.k?.kelompok === "PEMBELIAN") pembelian.push(baris(a, -a.net));
    else beban.push(baris(a, -a.net));
  }
  [pendapatan, pembelian, beban].forEach((l) => l.sort(urutKode));

  const totalPendapatan = jumlah(pendapatan);
  const totalPembelian = jumlah(pembelian);
  const totalBeban = jumlah(beban);
  const labaKotor = Math.round((totalPendapatan - totalPembelian) * 100) / 100;
  const labaBersih = Math.round((labaKotor - totalBeban) * 100) / 100;

  // ───────────── Neraca (per tanggal `sampai`) ─────────────
  const netPerRekening = new Map<string, Sen>();
  for (const e of entri) {
    netPerRekening.set(e.rekeningId, (netPerRekening.get(e.rekeningId) ?? 0) + e.net);
  }
  const kas = rekeningList.map((r) => ({
    rekeningId: r.id,
    nama: r.nama,
    saldo: rp(sen(r.saldoAwal) + (netPerRekening.get(r.id) ?? 0)),
  }));

  const asetLain: BarisLaporan[] = [];
  const liabilitas: BarisLaporan[] = [];
  const modal: BarisLaporan[] = [];
  for (const a of agregatPerKode(entri.filter((e) => kategori(e.kode) === "NERACA"))) {
    const kel = a.k?.kelompok;
    if (kel === "HARTA") asetLain.push(baris(a, -a.net));
    else if (kel === "UTANG" || kel === "PINJAMAN") liabilitas.push(baris(a, a.net));
    else if (kel === "MODAL") modal.push(baris(a, a.net));
    // Kelompok lain yang ditandai Neraca: saldo debit jadi aset, saldo kredit jadi liabilitas.
    else if (-a.net >= 0) asetLain.push(baris(a, -a.net));
    else liabilitas.push(baris(a, a.net));
  }
  [asetLain, liabilitas, modal].forEach((l) => l.sort(urutKode));

  const labaKumulatifSen = labaDari(entri);
  const labaBerjalanSen = labaDari(entri.filter((e) => e.tanggal >= tahunBerjalanMulai));
  const labaDitahanSen = labaKumulatifSen - labaBerjalanSen;

  const luarNeraca = luarLaporan(entri);
  const belumDiklasifikasiSen = entri
    .filter((e) => kategori(e.kode) === "LUAR")
    .reduce((s, e) => s + e.net, 0);

  const totalKas = jumlah(kas.map((k) => ({ nilai: k.saldo })));
  const totalAsetLain = jumlah(asetLain);
  const totalAset = Math.round((totalKas + totalAsetLain) * 100) / 100;
  const totalLiabilitas = jumlah(liabilitas);
  const totalModal = jumlah(modal);
  const totalEkuitasSen =
    saldoAwalSen + Math.round(totalModal * 100) + labaDitahanSen + labaBerjalanSen;
  const totalPasivaSen =
    Math.round(totalLiabilitas * 100) + totalEkuitasSen + belumDiklasifikasiSen;
  const selisihNeraca = Math.round(totalAset * 100) - totalPasivaSen;

  // ───────────── Arus Kas (periode) ─────────────
  const seksiKas: Record<"OPERASI" | "INVESTASI" | "PENDANAAN" | "PINDAH_DANA" | "BELUM", BarisLaporan[]> = {
    OPERASI: [],
    INVESTASI: [],
    PENDANAAN: [],
    PINDAH_DANA: [],
    BELUM: [],
  };
  for (const a of agregatPerKode(dalamPeriode)) {
    const seksi = a.k?.aktivitasKas ?? "BELUM";
    seksiKas[seksi].push(baris(a, a.net));
  }
  Object.values(seksiKas).forEach((l) => l.sort(urutKode));

  const kasAwalSen = saldoAwalSen + sebelumPeriode.reduce((s, e) => s + e.net, 0);
  const kenaikanSen = dalamPeriode.reduce((s, e) => s + e.net, 0);

  // ───────────── Perubahan Modal (periode) ─────────────
  const modalSebelumSen = sebelumPeriode
    .filter((e) => kategori(e.kode) === "NERACA" && e.kode?.kelompok === "MODAL")
    .reduce((s, e) => s + e.net, 0);
  const labaSebelumSen = labaDari(sebelumPeriode);
  const modalAwalSen = saldoAwalSen + modalSebelumSen + labaSebelumSen;

  const mutasiModal: BarisLaporan[] = agregatPerKode(
    dalamPeriode.filter((e) => kategori(e.kode) === "NERACA" && e.kode?.kelompok === "MODAL")
  )
    .map((a) => baris(a, a.net))
    .sort(urutKode);
  const totalMutasiModalSen = Math.round(jumlah(mutasiModal) * 100);
  const labaPeriodeSen = labaDari(dalamPeriode);
  const modalAkhirSen = modalAwalSen + totalMutasiModalSen + labaPeriodeSen;

  return {
    periode: { dari, sampai },
    rekening: rekeningList.map((r) => ({ id: r.id, nama: r.nama })),
    jumlahTransaksiPeriode: dalamPeriode.length,

    labaRugi: {
      pendapatan,
      pembelian,
      beban,
      totalPendapatan,
      totalPembelian,
      labaKotor,
      totalBeban,
      labaBersih,
      luarLaporan: luarLaporan(dalamPeriode),
    },

    neraca: {
      tanggal: sampai,
      kas,
      totalKas,
      asetLain,
      totalAsetLain,
      totalAset,
      liabilitas,
      totalLiabilitas,
      ekuitas: {
        saldoAwalRekening: rp(saldoAwalSen),
        modal,
        labaDitahan: rp(labaDitahanSen),
        labaBerjalan: rp(labaBerjalanSen),
        total: rp(totalEkuitasSen),
      },
      belumDiklasifikasi: { total: rp(belumDiklasifikasiSen), baris: luarNeraca },
      totalPasiva: rp(totalPasivaSen),
      selisih: rp(selisihNeraca),
      seimbang: selisihNeraca === 0,
    },

    arusKas: {
      kasAwal: rp(kasAwalSen),
      operasi: seksiKas.OPERASI,
      investasi: seksiKas.INVESTASI,
      pendanaan: seksiKas.PENDANAAN,
      pindahDana: seksiKas.PINDAH_DANA,
      belumDiklasifikasi: seksiKas.BELUM,
      total: {
        operasi: jumlah(seksiKas.OPERASI),
        investasi: jumlah(seksiKas.INVESTASI),
        pendanaan: jumlah(seksiKas.PENDANAAN),
        pindahDana: jumlah(seksiKas.PINDAH_DANA),
        belumDiklasifikasi: jumlah(seksiKas.BELUM),
      },
      kenaikan: rp(kenaikanSen),
      kasAkhir: rp(kasAwalSen + kenaikanSen),
      kasNeraca: totalKas,
    },

    perubahanModal: {
      awal: {
        saldoAwalRekening: rp(saldoAwalSen),
        modalDanPriveSebelumnya: rp(modalSebelumSen),
        labaSebelumnya: rp(labaSebelumSen),
        total: rp(modalAwalSen),
      },
      mutasiModal,
      totalMutasiModal: rp(totalMutasiModalSen),
      labaPeriode: rp(labaPeriodeSen),
      akhir: rp(modalAkhirSen),
      ekuitasNeraca: rp(totalEkuitasSen),
    },
  };
}

export type HasilLaporan = Awaited<ReturnType<typeof hitungLaporan>>;
