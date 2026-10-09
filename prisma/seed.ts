import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { AktivitasKas, Kelompok, Laporan, Role } from "../src/generated/prisma/enums";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/**
 * Chart of accounts milik tim Zaneva. Urutan array = urutan tampil di dropdown.
 *
 * Kode 0000 ditambahkan oleh sistem (tidak ada di daftar asli) karena contoh
 * rekap memakainya untuk baris saldo awal tiap rekening.
 */
const KODE_AKUN: [kode: string, nama: string, kelompok: Kelompok, sistem?: boolean][] = [
  ["0000", "Saldo", Kelompok.HARTA, true],

  ["100", "Harta", Kelompok.HARTA],
  ["101", "Cash On Bank", Kelompok.HARTA],
  ["10101", "Pengalihan Dana", Kelompok.HARTA],
  ["10102", "Setoran Dana", Kelompok.HARTA],
  ["102", "Cash On Hand", Kelompok.HARTA],
  ["103", "Persediaan Barang Dagang", Kelompok.HARTA],
  ["104", "Piutang", Kelompok.HARTA],
  ["10401", "Deposit SAP", Kelompok.HARTA],
  ["10402", "Deposit Mengantar", Kelompok.HARTA],
  ["10403", "Pinjaman Eksternal (Piutang)", Kelompok.HARTA],
  ["10405", "Outstanding Lazada Shopee", Kelompok.HARTA],
  ["10406", "Outstanding SAP", Kelompok.HARTA],
  ["10407", "Outstanding JNT", Kelompok.HARTA],
  ["10408", "Outstanding Tiktok", Kelompok.HARTA],
  ["10409", "Outstanding Tokopedia", Kelompok.HARTA],
  ["10410", "Outstanding Mengantar", Kelompok.HARTA],
  ["10411", "Deposit Iklan", Kelompok.HARTA],
  ["10412", "Piutang Lainnya", Kelompok.HARTA],
  ["10414", "Deposit Biznet", Kelompok.HARTA],
  ["10415", "Deposit Gaji", Kelompok.HARTA],
  ["105", "Bonus Ekspedisi", Kelompok.HARTA],
  ["106", "Piutang Usaha", Kelompok.HARTA],
  ["107", "Biaya Dibayar Dimuka", Kelompok.HARTA],
  ["108", "PPN Masukan", Kelompok.HARTA],
  ["109", "Aset Tetap Perlengkapan Kantor", Kelompok.HARTA],
  ["1-10101", "Piutang Belum Ditagih", Kelompok.HARTA],

  ["201", "Utang Usaha / Dagang", Kelompok.UTANG],
  ["202", "Pendapatan Diterima Dimuka", Kelompok.UTANG],
  ["203", "PPN Keluaran", Kelompok.UTANG],
  ["204", "Hutang ke Pusat", Kelompok.UTANG],
  ["205", "Hutang Modal", Kelompok.UTANG],
  ["206", "Hutang Gaji", Kelompok.UTANG],
  ["207", "Deposit Customer", Kelompok.UTANG],
  ["208", "Deposit Sijum", Kelompok.UTANG],
  ["209", "Tabungan SAP", Kelompok.UTANG],
  ["210", "Tiktok Elyasr", Kelompok.UTANG],
  ["211", "Deposit Elyasr", Kelompok.UTANG],
  ["212", "Hutang ke Kenzou", Kelompok.UTANG],
  ["213", "Deposit Lainnya", Kelompok.UTANG],
  ["2-20101", "Hutang Belum Ditagih", Kelompok.UTANG],
  ["2-602", "Hutang Komisi Admin", Kelompok.UTANG],
  ["2-604", "Hutang Sewa Gedung", Kelompok.UTANG],
  ["2-608", "Hutang Bekal Umroh", Kelompok.UTANG],
  ["2-609", "Hutang Iklan", Kelompok.UTANG],
  ["2-613", "Hutang Ekspedisi", Kelompok.UTANG],
  ["2-615", "Hutang Bunga Bank", Kelompok.UTANG],
  ["2-616", "Hutang Qurban", Kelompok.UTANG],
  ["2-618", "Hutang THR", Kelompok.UTANG],
  ["2-619", "Hutang Pesangon", Kelompok.UTANG],
  ["2-699", "Hutang Anggaran Pajak", Kelompok.UTANG],

  ["300", "Modal", Kelompok.MODAL],
  ["301", "Prive", Kelompok.MODAL],
  ["303", "Bank Pusat", Kelompok.MODAL],
  ["30301", "Alokasi Fixed Cost", Kelompok.MODAL],
  ["30302", "Alokasi Cash Back Ekspedisi", Kelompok.MODAL],
  ["30303", "Alokasi Sharing Profit", Kelompok.MODAL],
  ["30304", "Alokasi Cashback SAP", Kelompok.MODAL],

  ["400", "Penjualan / Pendapatan", Kelompok.PENDAPATAN],
  ["401", "Retur Penjualan", Kelompok.PENDAPATAN],
  ["402", "Penjualan Shopee", Kelompok.PENDAPATAN],
  ["403", "Penjualan Lazada", Kelompok.PENDAPATAN],
  ["404", "Pergantian KPB", Kelompok.PENDAPATAN],
  ["405", "Pendapatan Bunga Bank", Kelompok.PENDAPATAN],
  ["406", "Penjualan Tokopedia", Kelompok.PENDAPATAN],
  ["407", "Penjualan Tiktok", Kelompok.PENDAPATAN],
  ["408", "Penjualan SAP", Kelompok.PENDAPATAN],
  ["409", "Penjualan JNT VIP", Kelompok.PENDAPATAN],
  ["410", "Penjualan Mengantar", Kelompok.PENDAPATAN],
  ["4-40201", "Pendapatan Belum Ditagih", Kelompok.PENDAPATAN],
  ["7-70003", "Pembulatan", Kelompok.PENDAPATAN],

  ["500", "Beban Angkut Pembelian", Kelompok.PEMBELIAN],
  ["501", "Pembelian ke Vendor Arif", Kelompok.PEMBELIAN],
  ["502", "Pembelian ke Vendor Fahmi", Kelompok.PEMBELIAN],
  ["503", "Pembelian ke Vendor Dimas", Kelompok.PEMBELIAN],
  ["504", "Pembelian ke Vendor Anwar", Kelompok.PEMBELIAN],
  ["505", "Pembelian ke Vendor Hitjab", Kelompok.PEMBELIAN],
  ["506", "Pembelian ke Vendor Wahyu", Kelompok.PEMBELIAN],
  ["507", "Pembelian ke Vendor Ramdhan", Kelompok.PEMBELIAN],
  ["508", "Pembelian ke Vendor Zaneva", Kelompok.PEMBELIAN],
  ["509", "Pembelian ke Vendor Toni", Kelompok.PEMBELIAN],
  ["510", "Pembelian ke Vendor Ian", Kelompok.PEMBELIAN],
  ["511", "Pembelian ke Vendor Dindin", Kelompok.PEMBELIAN],
  ["512", "Pembelian ke Vendor WMD", Kelompok.PEMBELIAN],
  ["513", "Pembelian ke Vendor Dimam", Kelompok.PEMBELIAN],
  ["514", "Pembelian ke Vendor Yanti", Kelompok.PEMBELIAN],
  ["515", "Pembelian ke Vendor Vazya", Kelompok.PEMBELIAN],
  ["516", "Pembelian ke Vendor Evi", Kelompok.PEMBELIAN],
  ["517", "Pembelian ke Vendor Elok", Kelompok.PEMBELIAN],
  ["518", "Pembelian ke Vendor Bilal", Kelompok.PEMBELIAN],
  ["519", "Pembelian ke Vendor Fajar", Kelompok.PEMBELIAN],
  ["520", "Pembelian ke Vendor Lain", Kelompok.PEMBELIAN],
  ["52001", "Pembelian ke Vendor Rudi", Kelompok.PEMBELIAN],
  ["52002", "Pembelian ke Vendor Fauzan", Kelompok.PEMBELIAN],
  ["52003", "Pembelian ke Vendor S12", Kelompok.PEMBELIAN],
  ["52004", "Pembelian ke Vendor Oberbe", Kelompok.PEMBELIAN],
  ["52005", "Pembelian ke Vendor Suherman", Kelompok.PEMBELIAN],
  ["52006", "Pembelian ke Vendor Rivaldi", Kelompok.PEMBELIAN],
  ["52007", "Pembelian ke Vendor Jamal", Kelompok.PEMBELIAN],
  ["52008", "Pembelian ke Vendor Firman", Kelompok.PEMBELIAN],
  ["52009", "Pembelian ke Vendor Dita", Kelompok.PEMBELIAN],
  ["52010", "Pembelian ke Vendor Yuni", Kelompok.PEMBELIAN],
  ["52011", "Pembelian ke Vendor Trinda", Kelompok.PEMBELIAN],
  ["52012", "Pembelian ke Vendor Reni", Kelompok.PEMBELIAN],
  ["52013", "Pembelian ke Vendor Sae", Kelompok.PEMBELIAN],
  ["52014", "Pembelian ke Vendor Mastor", Kelompok.PEMBELIAN],
  ["52015", "Pembelian ke Vendor Wildan", Kelompok.PEMBELIAN],
  // Dihitung otomatis dari Stok Opname: persediaan awal − persediaan akhir. Bukan untuk transaksi bank.
  ["599", "Selisih HPP", Kelompok.PEMBELIAN, true],

  ["601", "Beban Gaji", Kelompok.BEBAN],
  ["602", "Beban Komisi Admin", Kelompok.BEBAN],
  ["603", "Beban Komisi Reseller", Kelompok.BEBAN],
  ["604", "Beban Sewa Gedung", Kelompok.BEBAN],
  ["605", "Beban Catering", Kelompok.BEBAN],
  ["60501", "Beban Catering Khusus", Kelompok.BEBAN],
  ["606", "Beban Listrik dan telepon", Kelompok.BEBAN],
  ["6-10114", "Beban Biznet", Kelompok.BEBAN],
  ["607", "Beban Pajak", Kelompok.BEBAN],
  ["60701", "Pajak Motor", Kelompok.BEBAN],
  ["608", "Beban Umroh", Kelompok.BEBAN],
  ["609", "Beban Iklan", Kelompok.BEBAN],
  ["60901", "Iklan FB", Kelompok.BEBAN],
  ["60902", "Iklan Shopee", Kelompok.BEBAN],
  ["60903", "Iklan Lazada", Kelompok.BEBAN],
  ["60904", "Iklan Tokopedia/Tiktok", Kelompok.BEBAN],
  ["60905", "Iklan Shopee - Oberbe", Kelompok.BEBAN],
  ["610", "Biaya Kerugian Ongkir", Kelompok.BEBAN],
  ["611", "Beban Adm Bank", Kelompok.BEBAN],
  ["61101", "Biaya Transfer Antar Bank", Kelompok.BEBAN],
  ["612", "Beban Pajak Bank", Kelompok.BEBAN],
  ["613", "Beban Pengiriman Ekspedisi", Kelompok.BEBAN],
  ["614", "Beban Kelebihan Transfer", Kelompok.BEBAN],
  ["615", "Beban Bunga Bank", Kelompok.BEBAN],
  ["616", "Beban Qurban", Kelompok.BEBAN],
  ["617", "Beban Jasa Marketplace", Kelompok.BEBAN],
  ["61701", "Beban Jasa MP Shopee", Kelompok.BEBAN],
  ["61702", "Beban Jasa MP Lazada", Kelompok.BEBAN],
  ["61703", "Beban Jasa MP Tokopedia", Kelompok.BEBAN],
  ["61704", "Beban Jasa MP Tiktok", Kelompok.BEBAN],
  ["618", "Beban THR", Kelompok.BEBAN],
  ["619", "Beban Pesangon", Kelompok.BEBAN],
  ["620", "Beban Lain-lain", Kelompok.BEBAN],
  ["62001", "Iklan Web", Kelompok.BEBAN],
  ["62002", "Beli / Perpanjang Fitur", Kelompok.BEBAN],
  ["62003", "Upgrade Web / Sistem", Kelompok.BEBAN],
  ["62004", "Paid Promote", Kelompok.BEBAN],
  ["62005", "Paid Endorse", Kelompok.BEBAN],
  ["62006", "Fee Advertiser", Kelompok.BEBAN],
  ["62007", "Promosi/Sponsorship", Kelompok.BEBAN],
  ["62008", "Penyesuaian Persediaan", Kelompok.BEBAN],
  ["62009", "Pengeluaran Barang Rusak", Kelompok.BEBAN],
  ["621", "Beban Operasional", Kelompok.BEBAN],
  ["62102", "Kuota", Kelompok.BEBAN],
  ["62103", "Photoshoot", Kelompok.BEBAN],
  ["62104", "Entertaint", Kelompok.BEBAN],
  ["690", "Anggaran Aset", Kelompok.BEBAN],
  ["699", "Anggaran Pajak", Kelompok.BEBAN],

  ["701", "Aktivitas Ikut Transfer", Kelompok.PINJAMAN],
  ["702", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70202", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70203", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70206", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70208", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70209", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70210", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70211", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70212", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70213", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["70214", "Pinjaman Internal", Kelompok.PINJAMAN],
  ["703", "Pinjaman Eksternal", Kelompok.PINJAMAN],
  ["70301", "Mertua akiki", Kelompok.PINJAMAN],

  ["801", "ZIS - Zakat", Kelompok.ALOKASI],
  ["80101", "Santunan Ramadhan", Kelompok.ALOKASI],
  ["80102", "Self Development / Konseling", Kelompok.ALOKASI],
  ["80103", "ZIS - Infaq Shadaqoh", Kelompok.ALOKASI],
  ["802", "Pengembangan Bisnis", Kelompok.ALOKASI],
  ["80201", "Operasional Bisnis", Kelompok.ALOKASI],
  ["80202", "Kuota Admin", Kelompok.ALOKASI],
  ["80203", "Photoshoot", Kelompok.ALOKASI],
  ["80204", "Entertaint", Kelompok.ALOKASI],
  ["80205", "Top Up Kas Besar", Kelompok.ALOKASI],
  ["80206", "Top Up Kas Kecil", Kelompok.ALOKASI],
  ["80207", "Konveksi Zaneva", Kelompok.ALOKASI],
  ["803", "Safety Cash", Kelompok.ALOKASI],
  ["804", "Upgrade Team", Kelompok.ALOKASI],
  ["80401", "Branding Zaneva (PE Artis)", Kelompok.ALOKASI],
  ["80402", "Branding Zaneva", Kelompok.ALOKASI],
  ["805", "Alokasi R", Kelompok.ALOKASI],
  ["80501", "Alokasi R Ekspedisi", Kelompok.ALOKASI],
  ["806", "Alokasi I", Kelompok.ALOKASI],
  ["807", "Cash Back Ekspedisi", Kelompok.ALOKASI],
  ["80701", "Holiday & Entertaint", Kelompok.ALOKASI],
  ["80702", "Budget Parcel (Dari Ekspedisi)", Kelompok.ALOKASI],
  ["80703", "Budget Bekel Umroh", Kelompok.ALOKASI],
  ["80704", "Budget Bonus Tahunan", Kelompok.ALOKASI],
  ["808", "Cashback SAP", Kelompok.ALOKASI],
  ["814", "Cashback Ekspedisi", Kelompok.ALOKASI],

  ["900", "SALDO IKLAN", Kelompok.LAINNYA],
];

/**
 * Tebakan awal "masuk laporan apa" berdasarkan kelompok — hanya titik awal,
 * pemilik bisnis yang menyesuaikan lewat UI. Mengembalikan undefined untuk kode
 * yang memang belum jelas, supaya tampil "Belum diatur" dan bukan ditebak.
 */
const BELUM_JELAS = new Set(["690", "699", "701"]);

function laporanAwal(kode: string, kelompok: Kelompok): Laporan | undefined {
  if (BELUM_JELAS.has(kode)) return undefined;
  switch (kelompok) {
    case Kelompok.HARTA:
    case Kelompok.UTANG:
    case Kelompok.MODAL:
    case Kelompok.PINJAMAN:
      return Laporan.NERACA;
    case Kelompok.PENDAPATAN:
    case Kelompok.PEMBELIAN:
    case Kelompok.BEBAN:
      return Laporan.LABA_RUGI;
    case Kelompok.LAINNYA:
      return kode === "900" ? Laporan.NERACA : undefined;
    case Kelompok.ALOKASI:
      // Pemakaian dana alokasi = pengurang ekuitas (bukan beban), supaya tidak mengurangi laba yang jadi dasar alokasi
      return Laporan.NERACA;
  }
}

/**
 * Tebakan awal aktivitas Arus Kas — titik awal saja, pemilik bisnis menyesuaikan
 * lewat UI. Kode yang belum jelas dibiarkan kosong ("Belum diatur").
 */
const PINDAH_DANA = new Set(["100", "101", "10101", "10102", "102"]);

function aktivitasAwal(kode: string, kelompok: Kelompok): AktivitasKas | undefined {
  if (BELUM_JELAS.has(kode) || kode === "0000") return undefined;
  if (PINDAH_DANA.has(kode)) return AktivitasKas.PINDAH_DANA;
  switch (kelompok) {
    case Kelompok.HARTA: // piutang, persediaan, deposit, bonus: modal kerja
    case Kelompok.UTANG:
    case Kelompok.PENDAPATAN:
    case Kelompok.PEMBELIAN:
    case Kelompok.BEBAN:
      return AktivitasKas.OPERASI;
    case Kelompok.MODAL:
    case Kelompok.PINJAMAN:
      return AktivitasKas.PENDANAAN;
    case Kelompok.LAINNYA:
      return kode === "900" ? AktivitasKas.OPERASI : undefined;
    case Kelompok.ALOKASI:
      // Dana alokasi dipakai = pembagian laba, bukan operasional
      return AktivitasKas.PENDANAAN;
  }
}

async function main() {
  const passwordAdmin = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      nama: "Administrator",
      username: "admin",
      passwordHash: await bcrypt.hash(passwordAdmin, 10),
      role: Role.OWNER,
    },
  });
  console.log(`User OWNER siap: ${admin.username}`);

  let dibuat = 0;
  for (const [index, [kode, nama, kelompok, sistem]] of KODE_AKUN.entries()) {
    const laporan = laporanAwal(kode, kelompok);
    const aktivitasKas = aktivitasAwal(kode, kelompok);
    // Kode yang sudah ada tidak ditimpa nama/kelompoknya — itu bisa sudah
    // disesuaikan lewat UI, dan seed tidak boleh membatalkan penyesuaian itu.
    await prisma.kodeAkun.upsert({
      where: { kode },
      update: { urutan: index, sistem: sistem ?? false },
      create: {
        kode,
        nama,
        kelompok,
        laporan,
        aktivitasKas,
        urutan: index,
        sistem: sistem ?? false,
      },
    });
    // Isi laporan & aktivitas kas hanya kalau masih kosong (belum pernah diatur siapa pun).
    if (laporan) {
      await prisma.kodeAkun.updateMany({ where: { kode, laporan: null }, data: { laporan } });
    }
    if (aktivitasKas) {
      await prisma.kodeAkun.updateMany({
        where: { kode, aktivitasKas: null },
        data: { aktivitasKas },
      });
    }
    dibuat++;
  }
  console.log(`Kode akun siap: ${dibuat} kode`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
