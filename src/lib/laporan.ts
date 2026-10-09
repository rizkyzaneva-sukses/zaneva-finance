import { prisma } from "@/lib/prisma";
import { hitungPersediaan, type RingkasPersediaan } from "@/lib/persediaan";
import type { AktivitasKas, Kelompok, Laporan } from "@/generated/prisma/enums";

/**
 * Laporan keuangan basis kas, diturunkan dari mutasi bank + kode akun.
 *
 * Prinsip: tiap transaksi punya "net" = uang masuk − uang keluar (dalam sen,
 * bilangan bulat). Transaksi yang di-split dipecah jadi entri per rincian,
 * jadi induknya tidak ikut terhitung dua kali. Semua laporan dihitung dari
 * kumpulan entri yang sama, sehingga identitas akuntansi terjaga.
 * Jurnal penyesuaian ikut di laba rugi, neraca, dan perubahan modal, tetapi
 * tidak di arus kas: total debit-kreditnya nol dan tidak menyentuh rekening.
 *
 *   Kas + Aset lain = Saldo awal + Liabilitas + Modal + Laba + Belum diklasifikasi
 *
 * "Belum diklasifikasi" menampung transaksi tanpa kode, atau yang kodenya belum
 * diatur masuk laporan apa. Neraca tetap seimbang, dan angka itu sengaja
 * ditampilkan mencolok supaya tidak ada uang yang hilang diam-diam.
 *
 * PENTING — identitas di atas benar secara konstruksi: tiap entri selalu masuk
 * ke kedua sisi neraca sekaligus, jadi selisihnya SELALU nol apa pun isi datanya.
 * Karena itu "neraca seimbang" bukan bukti laporan benar, dan tidak dipakai
 * sebagai pemeriksaan. Yang dipakai adalah `pemeriksaan` di bawah: kas versi
 * laporan dibandingkan dengan kolom saldo berjalan yang ditulis `hitungUlangSaldo` —
 * dua jalur hitung yang berbeda, jadi selisihnya berarti ada yang rusak.
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

/** Baris bernilai nol tidak dicetak di laporan keuangan — hanya menambah kebisingan. */
const tanpaNol = <T extends { nilai: number }>(list: T[]) => list.filter((b) => b.nilai !== 0);

function baris(a: Agregat, nilaiSen: Sen): BarisLaporan {
  return {
    kodeAkunId: a.k?.id ?? null,
    kode: a.k?.kode ?? "(tanpa kode)",
    nama: a.k?.nama ?? "Transaksi belum diberi kode akun",
    nilai: rp(nilaiSen),
  };
}

function luarLaporan(entri: Entri[]): BarisLuarLaporan[] {
  return tanpaNol(
    agregatPerKode(entri.filter((e) => kategori(e.kode) === "LUAR")).map((a) => ({
      ...baris(a, a.net),
      alasan: alasanLuar(a.k),
      jumlahTransaksi: a.n,
    }))
  ).sort(urutKode);
}

/**
 * Saldo kas per rekening menurut kolom `saldo` yang ditulis `hitungUlangSaldo`,
 * yaitu saldo transaksi terakhir pada atau sebelum `sampai`. Ini jalur hitung
 * yang berbeda dari laporan, jadi cocok dipakai sebagai pemeriksaan silang.
 */
async function kasTersimpan(sampai: string, rekeningIds: string[] | null): Promise<Sen> {
  const rekening = await prisma.rekening.findMany({
    where: rekeningIds ? { id: { in: rekeningIds } } : undefined,
    select: { id: true, saldoAwal: true },
  });

  let total: Sen = 0;
  for (const r of rekening) {
    const terakhir = await prisma.transaksi.findFirst({
      where: { rekeningId: r.id, tanggal: { lte: new Date(`${sampai}T00:00:00.000Z`) } },
      orderBy: [{ tanggal: "desc" }, { urutanInput: "desc" }, { createdAt: "desc" }],
      select: { saldo: true },
    });
    total += terakhir ? sen(terakhir.saldo) : sen(r.saldoAwal);
  }
  return total;
}

async function ambilEntri(sampai: string, rekeningIds: string[] | null) {
  const [transaksi, kodeList] = await Promise.all([
    prisma.transaksi.findMany({
      where: {
        tanggal: { lte: new Date(`${sampai}T00:00:00.000Z`) },
        ...(rekeningIds ? { rekeningId: { in: rekeningIds } } : {}),
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

/** Jurnal penyesuaian sampai tanggal tertentu. Net debit = seperti uang keluar. */
async function ambilPenyesuaian(sampai: string, brandIds: string[] | null): Promise<Entri[]> {
  const [jurnal, kodeList] = await Promise.all([
    prisma.jurnalPenyesuaian.findMany({
      where: {
        tanggal: { lte: new Date(`${sampai}T00:00:00.000Z`) },
        ...(brandIds ? { brandId: { in: brandIds } } : {}),
      },
      select: {
        tanggal: true,
        baris: { select: { kodeAkunId: true, debit: true, kredit: true } },
      },
    }),
    prisma.kodeAkun.findMany({
      select: { id: true, kode: true, nama: true, kelompok: true, laporan: true, aktivitasKas: true },
    }),
  ]);
  const peta = new Map<string, KodeInfo>(kodeList.map((k) => [k.id, k]));
  const entri: Entri[] = [];
  for (const j of jurnal) {
    const tanggal = j.tanggal.toISOString().slice(0, 10);
    for (const b of j.baris) {
      const debit = sen(b.debit);
      const kredit = sen(b.kredit);
      if (debit === 0 && kredit === 0) continue;
      entri.push({
        tanggal,
        rekeningId: "",
        kode: peta.get(b.kodeAkunId) ?? null,
        net: kredit - debit,
      });
    }
  }
  return entri;
}

/**
 * Net (uang masuk − uang keluar) per kode akun sampai tanggal tertentu, rincian
 * split ikut dihitung. Dipakai untuk saldo alokasi: pemakaian = −net.
 */
export async function netPerKodeAkun(sampai: string): Promise<Map<string, number>> {
  const [bank, jurnal] = await Promise.all([ambilEntri(sampai, null), ambilPenyesuaian(sampai, null)]);
  const entri = [...bank, ...jurnal];
  const hasil = new Map<string, Sen>();
  for (const e of entri) {
    if (!e.kode) continue;
    hasil.set(e.kode.id, (hasil.get(e.kode.id) ?? 0) + e.net);
  }
  return new Map([...hasil].map(([k, v]) => [k, rp(v)]));
}

export interface OpsiLaporan {
  dari: string;
  sampai: string;
  rekeningId: string | null;
  /** Laporan satu brand = rekening milik brand itu + persediaan brand itu. */
  brandId?: string | null;
  /** Pengguna dibatasi: laporan "semua" hanya mencakup brand-brand ini. null = tanpa batas. */
  batasBrandIds?: string[] | null;
}

const PERSEDIAAN_KOSONG: RingkasPersediaan = {
  adaAwal: false,
  awal: 0,
  sebelumPeriode: 0,
  akhir: 0,
  sebelumTahun: 0,
  posisiAkhir: null,
  posisiAwal: null,
  soTerakhir: null,
  soTerakhirMenjangkau: false,
};

export async function hitungLaporan({ dari, sampai, rekeningId, brandId = null, batasBrandIds = null }: OpsiLaporan) {
  // Cakupan: satu rekening, atau semua rekening milik satu brand, atau semuanya.
  let rekeningIds: string[] | null = rekeningId ? [rekeningId] : null;
  let brandIds: string[] | null = null; // null = persediaan semua brand
  if (!rekeningId && brandId) {
    const milikBrand = await prisma.rekening.findMany({ where: { brandId }, select: { id: true } });
    rekeningIds = milikBrand.map((r) => r.id);
    brandIds = [brandId];
  } else if (!rekeningId && batasBrandIds) {
    const milikBatas = await prisma.rekening.findMany({
      where: { brandId: { in: batasBrandIds } },
      select: { id: true },
    });
    rekeningIds = milikBatas.map((r) => r.id);
    brandIds = batasBrandIds;
  }
  // Persediaan tidak bisa dibagi per rekening, jadi hanya muncul di laporan semua/per brand.
  const pakaiPersediaan = !rekeningId;

  const [entriBank, entriJurnal, rekeningList, kasTersimpanSen, menungguAcc, persediaanHitung, kode599, rekeningTanpaBrand] =
    await Promise.all([
    ambilEntri(sampai, rekeningIds),
    rekeningId ? Promise.resolve([] as Entri[]) : ambilPenyesuaian(sampai, brandIds),
    prisma.rekening.findMany({
      where: rekeningIds ? { id: { in: rekeningIds } } : undefined,
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      select: { id: true, nama: true, saldoAwal: true, bank: true },
    }),
    kasTersimpan(sampai, rekeningIds),
    // Transaksi menunggu ACC TETAP dihitung di laporan: uangnya sudah berpindah
    // di rekening, yang menunggu hanya pengesahan pencatatannya. Jumlahnya
    // ditampilkan supaya pembaca tahu bagian mana yang belum final.
    prisma.transaksi.count({
      where: {
        statusAcc: { in: ["MENUNGGU", "PERLU_FINANCE"] },
        tanggal: {
          gte: new Date(`${dari}T00:00:00.000Z`),
          lte: new Date(`${sampai}T00:00:00.000Z`),
        },
        ...(rekeningIds ? { rekeningId: { in: rekeningIds } } : {}),
      },
    }),
    pakaiPersediaan ? hitungPersediaan(dari, sampai, brandIds) : Promise.resolve(PERSEDIAAN_KOSONG),
    prisma.kodeAkun.findUnique({ where: { kode: "599" }, select: { id: true } }),
    // Pengguna yang dibatasi tidak perlu tahu soal rekening di luar brand-nya
    batasBrandIds ? Promise.resolve(0) : prisma.rekening.count({ where: { brandId: null } }),
  ]);
  const P = persediaanHitung;
  // Selisih HPP periode ini = persediaan sebelum periode − persediaan akhir periode.
  const selisihHppSen = P.sebelumPeriode - P.akhir;

  const saldoAwalSen = rekeningList.reduce((s, r) => s + sen(r.saldoAwal), 0);
  const entri = [...entriBank, ...entriJurnal];
  const dalamPeriode = entri.filter((e) => e.tanggal >= dari && e.tanggal <= sampai);
  const sebelumPeriode = entri.filter((e) => e.tanggal < dari);
  const dalamPeriodeKas = entriBank.filter((e) => e.tanggal >= dari && e.tanggal <= sampai);
  const sebelumPeriodeKas = entriBank.filter((e) => e.tanggal < dari);
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
  // Selisih HPP otomatis dari Stok Opname; digabung dengan transaksi bank berkode 599 kalau ada.
  if (selisihHppSen !== 0) {
    const ada = pembelian.find((b) => b.kode === "599");
    if (ada) ada.nilai = rp(Math.round(ada.nilai * 100) + selisihHppSen);
    else {
      pembelian.push({
        kodeAkunId: kode599?.id ?? null,
        kode: "599",
        nama: "Selisih HPP (persediaan awal − akhir)",
        nilai: rp(selisihHppSen),
      });
    }
  }
  const lrPendapatan = tanpaNol(pendapatan).sort(urutKode);
  const lrPembelian = tanpaNol(pembelian).sort(urutKode);
  const lrBeban = tanpaNol(beban).sort(urutKode);

  const totalPendapatan = jumlah(pendapatan);
  const totalPembelian = jumlah(pembelian);
  const totalBeban = jumlah(beban);
  const labaKotor = Math.round((totalPendapatan - totalPembelian) * 100) / 100;
  const labaBersih = Math.round((labaKotor - totalBeban) * 100) / 100;

  // ───────────── Neraca (per tanggal `sampai`) ─────────────
  const netPerRekening = new Map<string, Sen>();
  for (const e of entriBank) {
    netPerRekening.set(e.rekeningId, (netPerRekening.get(e.rekeningId) ?? 0) + e.net);
  }
  const kas = rekeningList.map((r) => ({
    rekeningId: r.id,
    nama: r.nama,
    // Petty cash dipisah sebagai kelompok sendiri di Neraca, tapi tetap kas.
    jenis: r.bank === "PETTY_CASH" ? ("PETTY_CASH" as const) : ("BANK" as const),
    saldo: rp(sen(r.saldoAwal) + (netPerRekening.get(r.id) ?? 0)),
  }));

  const asetLain: BarisLaporan[] = [];
  const liabilitas: BarisLaporan[] = [];
  const modal: BarisLaporan[] = [];
  for (const a of agregatPerKode(entri.filter((e) => kategori(e.kode) === "NERACA"))) {
    const kel = a.k?.kelompok;
    if (kel === "HARTA") asetLain.push(baris(a, -a.net));
    else if (kel === "UTANG" || kel === "PINJAMAN") liabilitas.push(baris(a, a.net));
    else if (kel === "MODAL" || kel === "ALOKASI") modal.push(baris(a, a.net));
    // Kelompok lain yang ditandai Neraca: saldo debit jadi aset, saldo kredit jadi liabilitas.
    else if (-a.net >= 0) asetLain.push(baris(a, -a.net));
    else liabilitas.push(baris(a, a.net));
  }
  // Kode 103 "Persediaan Barang Dagang" bisa terisi dari transaksi bank. Kalau SO juga dipakai,
  // barang yang sama terhitung dua kali — ditandai di laporan supaya pembelian dipindah ke kode 5xx.
  const bentrok103 = P.adaAwal ? (asetLain.find((b) => b.kode === "103")?.nilai ?? 0) : 0;
  if (P.adaAwal) {
    asetLain.push({
      kodeAkunId: null,
      kode: "",
      nama: `Persediaan barang (SO per ${new Date(`${P.posisiAkhir}T00:00:00.000Z`).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })})`,
      nilai: rp(P.akhir),
    });
  }
  const nAsetLain = tanpaNol(asetLain).sort(urutKode);
  const nLiabilitas = tanpaNol(liabilitas).sort(urutKode);
  const nModal = tanpaNol(modal).sort(urutKode);

  // Laba dari transaksi bank dikurangi selisih HPP (persediaan awal − persediaan pada tanggal itu).
  const labaKumulatifSen = labaDari(entri) - (P.awal - P.akhir);
  const labaBerjalanSen =
    labaDari(entri.filter((e) => e.tanggal >= tahunBerjalanMulai)) - (P.sebelumTahun - P.akhir);
  const labaDitahanSen = labaKumulatifSen - labaBerjalanSen;

  const luarNeraca = luarLaporan(entri);
  const belumDiklasifikasiSen = entri
    .filter((e) => kategori(e.kode) === "LUAR")
    .reduce((s, e) => s + e.net, 0);

  const totalKas = jumlah(kas.map((k) => ({ nilai: k.saldo })));
  const totalBank = jumlah(kas.filter((k) => k.jenis === "BANK").map((k) => ({ nilai: k.saldo })));
  const totalPettyCash = jumlah(
    kas.filter((k) => k.jenis === "PETTY_CASH").map((k) => ({ nilai: k.saldo }))
  );
  const totalAsetLain = jumlah(asetLain);
  const totalAset = Math.round((totalKas + totalAsetLain) * 100) / 100;
  const totalLiabilitas = jumlah(liabilitas);
  const totalModal = jumlah(modal);
  const totalEkuitasSen =
    saldoAwalSen + P.awal + Math.round(totalModal * 100) + labaDitahanSen + labaBerjalanSen;
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
  for (const a of agregatPerKode(dalamPeriodeKas)) {
    const seksi = a.k?.aktivitasKas ?? "BELUM";
    seksiKas[seksi].push(baris(a, a.net));
  }
  for (const k of Object.keys(seksiKas) as (keyof typeof seksiKas)[]) {
    seksiKas[k] = tanpaNol(seksiKas[k]).sort(urutKode);
  }

  const kasAwalSen = saldoAwalSen + sebelumPeriodeKas.reduce((s, e) => s + e.net, 0);
  const kenaikanSen = dalamPeriodeKas.reduce((s, e) => s + e.net, 0);

  // ───────────── Perubahan Modal (periode) ─────────────
  const modalSebelumSen = sebelumPeriode
    .filter((e) => kategori(e.kode) === "NERACA" && (e.kode?.kelompok === "MODAL" || e.kode?.kelompok === "ALOKASI"))
    .reduce((s, e) => s + e.net, 0);
  const labaSebelumSen = labaDari(sebelumPeriode) - (P.awal - P.sebelumPeriode);
  const modalAwalSen = saldoAwalSen + P.awal + modalSebelumSen + labaSebelumSen;

  const mutasiModal: BarisLaporan[] = tanpaNol(
    agregatPerKode(
      dalamPeriode.filter((e) => kategori(e.kode) === "NERACA" && (e.kode?.kelompok === "MODAL" || e.kode?.kelompok === "ALOKASI"))
    ).map((a) => baris(a, a.net))
  ).sort(urutKode);
  const totalMutasiModalSen = Math.round(jumlah(mutasiModal) * 100);
  const labaPeriodeSen = labaDari(dalamPeriode) - selisihHppSen;
  const modalAkhirSen = modalAwalSen + totalMutasiModalSen + labaPeriodeSen;

  const selisihKas = Math.round(totalKas * 100) - kasTersimpanSen;

  return {
    periode: { dari, sampai },
    rekening: rekeningList.map((r) => ({ id: r.id, nama: r.nama })),
    jumlahTransaksiPeriode: dalamPeriodeKas.length,
    adaPenyesuaian: entriJurnal.some((e) => e.tanggal >= dari && e.tanggal <= sampai),
    menungguAcc,

    cakupan: {
      brandId: rekeningId ? null : brandId,
      rekeningTanpaBrand,
      jumlahRekening: rekeningList.length,
    },
    persediaan: {
      dipakai: pakaiPersediaan,
      adaAwal: P.adaAwal,
      awal: rp(P.awal),
      sebelumPeriode: rp(P.sebelumPeriode),
      akhir: rp(P.akhir),
      selisihHpp: rp(selisihHppSen),
      /** Saldo kode 103 di Neraca padahal SO dipakai: kemungkinan dobel dengan persediaan SO */
      bentrokKode103: bentrok103,
      posisiAkhir: P.posisiAkhir,
      soTerakhir: P.soTerakhir,
      /** false = periode ini melewati SO terakhir; angka persediaan akhir mungkin belum final */
      soMenjangkau: P.soTerakhirMenjangkau,
    },

    /**
     * Satu-satunya pemeriksaan yang berarti di laporan ini: kas versi laporan
     * (saldo awal + seluruh mutasi) dibandingkan dengan kolom saldo berjalan
     * yang ditulis saat transaksi disimpan. Selisih berarti ada data rusak.
     */
    pemeriksaan: {
      kasLaporan: totalKas,
      kasTersimpan: rp(kasTersimpanSen),
      selisih: rp(selisihKas),
      cocok: selisihKas === 0,
      /** Satu rekening dipilih: transfer antar rekening cuma terlihat sebelah */
      satuRekening: rekeningId !== null,
    },

    labaRugi: {
      pendapatan: lrPendapatan,
      pembelian: lrPembelian,
      beban: lrBeban,
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
      totalBank,
      totalPettyCash,
      asetLain: nAsetLain,
      totalAsetLain,
      totalAset,
      liabilitas: nLiabilitas,
      totalLiabilitas,
      ekuitas: {
        saldoAwalRekening: rp(saldoAwalSen),
        persediaanAwal: rp(P.awal),
        modal: nModal,
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
        persediaanAwal: rp(P.awal),
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
