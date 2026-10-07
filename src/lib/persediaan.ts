import { prisma } from "@/lib/prisma";

/**
 * Nilai persediaan dari Stok Opname, dipakai Laporan.
 *
 * Persediaan pada tanggal T = SO terakhir yang `posisiPada`-nya <= T. Sebelum SO
 * pertama dipakai persediaan awal (jenis AWAL), jadi fungsinya tidak pernah
 * "kosong" setelah persediaan awal ada. SO yang masih menunggu ACC tetap dihitung,
 * sama seperti transaksi yang menunggu ACC (lihat enum StatusAcc).
 *
 * Selisih HPP satu periode = persediaan di hari sebelum periode − persediaan di
 * akhir periode. Deretan selisih itu saling menutup (telescoping) dari persediaan
 * awal, sehingga Neraca seimbang: aset Persediaan = persediaan awal (modal awal)
 * + kumulatif (akhir − awal) yang mengalir lewat laba.
 */

type Sen = number;

export interface SnapshotNilai {
  id: string;
  jenis: "AWAL" | "BULANAN";
  posisiPada: string; // YYYY-MM-DD
  perBrand: Map<string, Sen>;
}

const sen = (d: { mul: (n: number) => { toNumber: () => number } }): Sen =>
  Math.round(d.mul(100).toNumber());

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Tanggal ISO dikurangi n hari (UTC, tanpa pengaruh zona waktu). */
export function kurangiHari(tanggal: string, n: number): string {
  const d = new Date(`${tanggal}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return iso(d);
}

export async function muatSnapshot(): Promise<{ awal: SnapshotNilai | null; bulanan: SnapshotNilai[] }> {
  const [so, nilai] = await Promise.all([
    prisma.stokOpname.findMany({
      select: { id: true, jenis: true, posisiPada: true },
      orderBy: { posisiPada: "asc" },
    }),
    prisma.stokOpnameItem.groupBy({ by: ["stokOpnameId", "brandId"], _sum: { nilai: true } }),
  ]);

  const perSo = new Map<string, Map<string, Sen>>();
  for (const n of nilai) {
    const m = perSo.get(n.stokOpnameId) ?? new Map<string, Sen>();
    m.set(n.brandId, n._sum.nilai ? sen(n._sum.nilai) : 0);
    perSo.set(n.stokOpnameId, m);
  }

  const semua: SnapshotNilai[] = so.map((s) => ({
    id: s.id,
    jenis: s.jenis,
    posisiPada: iso(s.posisiPada),
    perBrand: perSo.get(s.id) ?? new Map(),
  }));
  return { awal: semua.find((s) => s.jenis === "AWAL") ?? null, bulanan: semua.filter((s) => s.jenis === "BULANAN") };
}

/** Jumlah nilai snapshot untuk brand tertentu (null = semua brand). */
function totalBrand(s: SnapshotNilai | null, brandIds: string[] | null): Sen {
  if (!s) return 0;
  let t = 0;
  for (const [brandId, v] of s.perBrand) {
    if (brandIds === null || brandIds.includes(brandId)) t += v;
  }
  return t;
}

export interface RingkasPersediaan {
  /** Sudah ada persediaan awal? Kalau belum, semua angka di bawah 0 dan laporan tidak berubah. */
  adaAwal: boolean;
  awal: Sen;
  /** Persediaan pada hari sebelum `dari` */
  sebelumPeriode: Sen;
  /** Persediaan pada `sampai` */
  akhir: Sen;
  /** Persediaan pada hari sebelum 1 Januari tahun `sampai` */
  sebelumTahun: Sen;
  /** Tanggal SO yang dipakai untuk `akhir`, dan apakah SO itu sudah mencapai `sampai` */
  posisiAkhir: string | null;
  posisiAwal: string | null;
  /** SO terakhir yang ada, untuk peringatan "belum ada SO untuk periode ini" */
  soTerakhir: string | null;
  soTerakhirMenjangkau: boolean;
}

export async function hitungPersediaan(
  dari: string,
  sampai: string,
  brandIds: string[] | null
): Promise<RingkasPersediaan> {
  const { awal, bulanan } = await muatSnapshot();
  if (!awal) {
    return {
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
  }

  const pada = (tanggal: string): SnapshotNilai => {
    let pakai: SnapshotNilai = awal;
    for (const s of bulanan) {
      if (s.posisiPada <= tanggal) pakai = s;
    }
    return pakai;
  };

  const akhirSnap = pada(sampai);
  const terakhir = bulanan.length > 0 ? bulanan[bulanan.length - 1] : awal;
  return {
    adaAwal: true,
    awal: totalBrand(awal, brandIds),
    sebelumPeriode: totalBrand(pada(kurangiHari(dari, 1)), brandIds),
    akhir: totalBrand(akhirSnap, brandIds),
    sebelumTahun: totalBrand(pada(kurangiHari(`${sampai.slice(0, 4)}-01-01`, 1)), brandIds),
    posisiAkhir: akhirSnap.posisiPada,
    posisiAwal: awal.posisiPada,
    soTerakhir: terakhir.posisiPada,
    soTerakhirMenjangkau: terakhir.posisiPada >= sampai,
  };
}
