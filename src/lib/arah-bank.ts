export type ArahBank = "masuk" | "keluar";

/**
 * Arah yang tertulis di keterangan mutasi, kalau tidak ambigu.
 * Mandiri/BCA: CR dan KR OTOMATIS = uang masuk, DB dan tarikan ATM = uang keluar.
 */
export function arahDariKeterangan(keterangan: string): ArahBank | null {
  const t = keterangan.toUpperCase();
  if (/\bKR\s+OTOMATIS\b|\bKREDIT\s+OTOMATIS\b/.test(t)) return "masuk";
  const cr = /\bCR\b/.test(t);
  const db = /\bDB\b/.test(t);
  if (cr && !db) return "masuk";
  if (db && !cr) return "keluar";
  if (/\bTARIK(?:AN)?\s+(?:TUNAI\s+)?ATM\b|\bPENARIKAN\s+ATM\b/.test(t)) return "keluar";
  return null;
}

/** Pindahkan nominal ke kolom yang sesuai keterangan. Baris ambigu tidak disentuh. */
export function sesuaikanArahBank<T extends { keterangan: string; uangMasuk: number; uangKeluar: number }>(
  baris: T
): { baris: T; diubah: boolean } {
  const arah = arahDariKeterangan(baris.keterangan);
  if (!arah) return { baris, diubah: false };
  const masuk = Number(baris.uangMasuk) || 0;
  const keluar = Number(baris.uangKeluar) || 0;
  if ((masuk > 0 && keluar > 0) || (masuk === 0 && keluar === 0)) return { baris, diubah: false };
  const sekarang: ArahBank = masuk > 0 ? "masuk" : "keluar";
  if (sekarang === arah) return { baris, diubah: false };
  return { baris: { ...baris, uangMasuk: keluar, uangKeluar: masuk }, diubah: true };
}

export function sesuaikanArahSemua<T extends { keterangan: string; uangMasuk: number; uangKeluar: number }>(
  daftar: T[]
): { baris: T[]; dibalik: number } {
  let dibalik = 0;
  const baris = daftar.map((item) => {
    const hasil = sesuaikanArahBank(item);
    if (hasil.diubah) dibalik += 1;
    return hasil.baris;
  });
  return { baris, dibalik };
}
