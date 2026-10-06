/**
 * Satu baris transaksi hasil parsing, sebelum masuk DB.
 *
 * Bentuknya sengaja sama untuk semua sumber (screenshot bank apa pun, PDF,
 * input manual) supaya pipeline setelahnya — klasifikasi kode, dedupe,
 * hitung saldo — tidak perlu tahu asalnya dari bank mana.
 */
export interface BarisParsing {
  /** Tanggal apa adanya seperti terbaca, mis. "1 November 2023" */
  tanggalTeks: string;
  /** Hasil normalisasi tanggalTeks; null kalau tidak terbaca */
  tanggalIso: string | null;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  /** Saldo yang terbaca di mutasi, kalau ada. Hanya pembanding. */
  saldoBank: number | null;
  /** false kalau AI tidak yakin membacanya (buram/terpotong) */
  yakin: boolean;
  sumberFile?: string;
}

/** Baris setelah dapat saran kode akun dari AI */
export interface BarisTerklasifikasi extends BarisParsing {
  kodeAkunId: string | null;
  kode: string | null;
  statusKode: "KOSONG" | "SARAN_AI" | "DIKONFIRMASI";
  catatan: string;
}

export interface RingkasanSimpan {
  tersimpan: number;
  dilewati: number;
  barisDilewati: { tanggalTeks: string; keterangan: string; nominal: number }[];
}

export interface MandiriMeta {
  nomorRekening?: string;
  nama?: string;
  periode?: string;
  saldoAwal?: number;
  saldoAkhir?: number;
}

export interface HasilParsing {
  baris: BarisParsing[];
  meta?: MandiriMeta;
}
