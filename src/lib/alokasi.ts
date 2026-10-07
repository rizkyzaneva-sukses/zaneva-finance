import { Prisma } from "@/generated/prisma/client";
import { hitungLaporan } from "@/lib/laporan";

const dua = (n: number) => String(n).padStart(2, "0");

export function rentangBulan(tahun: number, bulan: number) {
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  return {
    dari: `${tahun}-${dua(bulan)}-01`,
    sampai: `${tahun}-${dua(bulan)}-${dua(hariTerakhir)}`,
  };
}

/** Bulan berjalan menurut WIB, bukan zona waktu server — penentu bulan mana yang sudah berakhir. */
export function bulanBerjalanWib(sekarang = new Date()) {
  const bagian = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(sekarang);
  const ambil = (t: string) => Number(bagian.find((p) => p.type === t)?.value);
  return { tahun: ambil("year"), bulan: ambil("month"), hari: ambil("day") };
}

export function hariIniWib(sekarang = new Date()): string {
  const { tahun, bulan, hari } = bulanBerjalanWib(sekarang);
  return `${tahun}-${dua(bulan)}-${dua(hari)}`;
}

/** Bulan baru boleh ditutup setelah berakhir — laba bulan yang masih jalan belum final. */
export function bulanSudahBerakhir(tahun: number, bulan: number): boolean {
  const kini = bulanBerjalanWib();
  return tahun * 12 + bulan < kini.tahun * 12 + kini.bulan;
}

export function bulanValid(tahun: unknown, bulan: unknown): { tahun: number; bulan: number } | null {
  const t = Number(tahun);
  const b = Number(bulan);
  if (!Number.isInteger(t) || !Number.isInteger(b) || t < 2000 || t > 2100 || b < 1 || b > 12) {
    return null;
  }
  return { tahun: t, bulan: b };
}

/** Laba bersih seluruh rekening pada satu bulan, dihitung langsung dari laporan. */
export async function labaBulan(tahun: number, bulan: number) {
  const { dari, sampai } = rentangBulan(tahun, bulan);
  const lap = await hitungLaporan({ dari, sampai, rekeningId: null });
  // Transaksi yang belum masuk laporan manapun membuat laba tidak lengkap.
  const belumMasuk = lap.labaRugi.luarLaporan.filter((b) => b.alasan !== "TIDAK_MASUK_LAPORAN");
  return {
    laba: lap.labaRugi.labaBersih,
    belumMasuk: {
      jumlahTransaksi: belumMasuk.reduce((s, b) => s + b.jumlahTransaksi, 0),
      nilai: Math.round(belumMasuk.reduce((s, b) => s + b.nilai, 0) * 100) / 100,
    },
    menungguAcc: lap.menungguAcc,
    // SO sudah dipakai tapi belum ada yang menjangkau akhir bulan ini: Selisih HPP, jadi laba, belum final.
    soBelumMenjangkau: lap.persediaan.adaAwal && !lap.persediaan.soMenjangkau,
    jumlahTransaksi: lap.jumlahTransaksiPeriode,
  };
}

export interface KodeBerpersen {
  id: string;
  persen: Prisma.Decimal;
}

/**
 * Jatah tiap kode = laba × persen. Laba nol atau negatif tidak dibagikan sama
 * sekali — alokasi adalah pembagian laba, bukan utang yang ditagih saat rugi.
 */
export function hitungJatah(laba: Prisma.Decimal, kode: KodeBerpersen[]) {
  if (laba.lte(0)) return [];
  return kode.map((k) => ({
    kodeAkunId: k.id,
    persen: k.persen,
    nominal: laba.mul(k.persen).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  }));
}

export function totalPersen(kode: KodeBerpersen[]): Prisma.Decimal {
  return kode.reduce((s, k) => s.plus(k.persen), new Prisma.Decimal(0));
}
