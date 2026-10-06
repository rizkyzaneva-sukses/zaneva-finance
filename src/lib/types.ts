export interface BniTransaction {
  tanggal: string;
  uraian: string;
  type: string; // "Db" atau "Cr"
  jumlah: number;
  saldo: number;
  yakin: boolean;
  sumber?: string; // nama file gambar asalnya
}

export interface MandiriTransaction {
  tanggal: string;
  transaksi: string;
  debit: number;
  kredit: number;
  /** null kalau sumbernya screenshot app (tidak menampilkan saldo berjalan) */
  saldo: number | null;
  yakin?: boolean;
  sumber?: string;
}

export interface MandiriMeta {
  nomorRekening?: string;
  nama?: string;
  periode?: string;
  saldoAwal?: number;
  saldoAkhir?: number;
}

export interface MandiriParseResult {
  meta: MandiriMeta;
  transactions: MandiriTransaction[];
  verifikasi: {
    cocok: boolean;
    selisih: number;
    totalDebit: number;
    totalKredit: number;
  } | null;
}
