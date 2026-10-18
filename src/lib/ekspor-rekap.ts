import type { BarisRekapExcel } from "@/lib/excel";

/**
 * Bentuk minimal transaksi yang dibutuhkan untuk menyusun baris rekap.
 *
 * Sengaja struktural (bukan `Prisma.TransaksiGetPayload<...>`) supaya file ini
 * bisa dipakai route export mana pun tanpa ikut menyeret tipe generated Prisma
 * yang panjang — dan supaya gampang dites dengan objek biasa.
 */
/**
 * Prisma mengembalikan kolom Decimal sebagai objek decimal.js, bukan number.
 * `Number(...)` menanganinya lewat valueOf, jadi tipe di sini dibuat longgar.
 */
type Angka = number | string | { toString(): string };

export interface RincianSumber {
  nominal: Angka;
  keterangan: string | null;
  kodeAkun: { kode: string; nama: string };
}

export interface TransaksiSumber {
  tanggal: Date | string;
  keterangan: string;
  uangMasuk: Angka;
  uangKeluar: Angka;
  saldo: Angka;
  catatan: string | null;
  yakin: boolean;
  kodeAkun: { kode: string } | null;
  rincian: RincianSumber[];
}

/** "1.250.000,00" — dipakai di catatan baris split. */
function angkaDesimal(nilai: number): string {
  return new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(nilai);
}

/**
 * Ubah transaksi tersimpan jadi baris rekap siap-Excel.
 *
 * Transaksi yang di-split tampil sebagai baris-baris rinciannya: transaksi asli
 * dari bank masuk ke kolom Catatan, dan saldo berjalan naik/turun per rincian
 * sehingga baris terakhir tetap berakhir di saldo bank yang sebenarnya.
 */
export function barisDariTransaksi(transaksi: TransaksiSumber[]): BarisRekapExcel[] {
  return transaksi.flatMap((t): BarisRekapExcel[] => {
    const masuk = Number(t.uangMasuk);
    const keluar = Number(t.uangKeluar);

    if (t.rincian.length === 0) {
      return [
        {
          tanggal: t.tanggal,
          kode: t.kodeAkun?.kode ?? "",
          keterangan: t.keterangan,
          uangMasuk: masuk,
          uangKeluar: keluar,
          saldo: Number(t.saldo),
          catatan: t.catatan ?? "",
          yakin: t.yakin,
        },
      ];
    }

    const arahMasuk = masuk > 0;
    const total = arahMasuk ? masuk : keluar;
    const asli = `Split dari: ${t.keterangan} (${angkaDesimal(total)})`;
    let berjalan = Number(t.saldo) - masuk + keluar;

    return t.rincian.map((r) => {
      const nominal = Number(r.nominal);
      berjalan = arahMasuk ? berjalan + nominal : berjalan - nominal;
      return {
        tanggal: t.tanggal,
        kode: r.kodeAkun.kode,
        keterangan: r.keterangan ?? r.kodeAkun.nama,
        uangMasuk: arahMasuk ? nominal : 0,
        uangKeluar: arahMasuk ? 0 : nominal,
        saldo: berjalan,
        catatan: t.catatan ? `${asli} — ${t.catatan}` : asli,
        yakin: t.yakin,
      };
    });
  });
}
