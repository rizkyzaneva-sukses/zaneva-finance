import { hitungLaporan } from "@/lib/laporan";
import { bulanBerjalanWib, hariIniWib, rentangBulan } from "@/lib/alokasi";

/**
 * Ringkasan laba per bulan untuk Dashboard, diambil dari mesin Laporan yang sama
 * (jadi angkanya identik dengan halaman Laporan, termasuk Selisih HPP dari SO).
 */
export interface RingkasBulan {
  dari: string;
  sampai: string;
  pendapatan: number;
  hpp: number; // pembelian + Selisih HPP
  labaKotor: number;
  beban: number;
  labaBersih: number;
  /** SO sudah dipakai tapi belum ada yang menjangkau akhir bulan ini: Selisih HPP belum final */
  hppBelumFinal: boolean;
}

async function ringkasSatuBulan(
  dari: string,
  sampai: string,
  brandId: string | null,
  rekeningId: string | null,
  batasBrandIds: string[] | null
): Promise<{ bulan: RingkasBulan; persediaan: { dipakai: boolean; adaAwal: boolean; nilai: number; posisi: string | null } }> {
  const lap = await hitungLaporan({ dari, sampai, rekeningId, brandId, batasBrandIds });
  return {
    bulan: {
      dari,
      sampai,
      pendapatan: lap.labaRugi.totalPendapatan,
      hpp: lap.labaRugi.totalPembelian,
      labaKotor: lap.labaRugi.labaKotor,
      beban: lap.labaRugi.totalBeban,
      labaBersih: lap.labaRugi.labaBersih,
      hppBelumFinal: lap.persediaan.dipakai && lap.persediaan.adaAwal && !lap.persediaan.soMenjangkau,
    },
    persediaan: {
      dipakai: lap.persediaan.dipakai,
      adaAwal: lap.persediaan.adaAwal,
      nilai: lap.persediaan.akhir,
      posisi: lap.persediaan.posisiAkhir,
    },
  };
}

function periodeBulan() {
  const kini = bulanBerjalanWib();
  const lalu = kini.bulan === 1 ? { tahun: kini.tahun - 1, bulan: 12 } : { tahun: kini.tahun, bulan: kini.bulan - 1 };
  return {
    ini: { dari: rentangBulan(kini.tahun, kini.bulan).dari, sampai: hariIniWib() },
    lalu: rentangBulan(lalu.tahun, lalu.bulan),
  };
}

/** Bulan lalu dan bulan berjalan untuk satu cakupan (semua / satu brand / satu rekening). */
export async function ringkasBulanan(
  brandId: string | null,
  rekeningId: string | null,
  batasBrandIds: string[] | null = null
) {
  const p = periodeBulan();
  const [lalu, ini] = await Promise.all([
    ringkasSatuBulan(p.lalu.dari, p.lalu.sampai, brandId, rekeningId, batasBrandIds),
    ringkasSatuBulan(p.ini.dari, p.ini.sampai, brandId, rekeningId, batasBrandIds),
  ]);
  return {
    bulanLalu: lalu.bulan,
    bulanIni: ini.bulan,
    // Persediaan terkini = SO terakhir yang tanggalnya sudah lewat, per hari ini
    persediaan: ini.persediaan,
  };
}

/** Satu baris per brand untuk tabel perbandingan: persediaan terkini dan laba bulan lalu. */
export async function ringkasPerBrand(brandIds: string[]) {
  const p = periodeBulan();
  return Promise.all(
    brandIds.map(async (id) => {
      const [lalu, ini] = await Promise.all([
        ringkasSatuBulan(p.lalu.dari, p.lalu.sampai, id, null, null),
        ringkasSatuBulan(p.ini.dari, p.ini.sampai, id, null, null),
      ]);
      return {
        brandId: id,
        persediaan: ini.persediaan.nilai,
        labaKotorLalu: lalu.bulan.labaKotor,
        labaBersihLalu: lalu.bulan.labaBersih,
        hppBelumFinalLalu: lalu.bulan.hppBelumFinal,
      };
    })
  );
}
