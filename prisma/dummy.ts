/**
 * Data dummy untuk mencoba halaman Laporan (Laba Rugi, Neraca, Arus Kas, Perubahan Modal).
 *
 *   npm run db:dummy          → buat (atau buat ulang) data dummy
 *   npm run db:dummy:hapus    → hapus semua data dummy
 *
 * Semua rekening dummy berawalan "[DUMMY]". Skrip ini hanya menyentuh rekening
 * berawalan itu beserta transaksinya — data aslimu tidak disentuh.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { Bank, StatusKode, Sumber } from "../src/generated/prisma/enums";
import { buatDedupeHash, hitungUlangSaldo } from "../src/lib/rekap";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const AWALAN = "[DUMMY]";

type KunciRek = "BCA" | "MDR" | "BRI";

const REKENING: Record<KunciRek, { nama: string; bank: Bank; saldoAwal: number }> = {
  BCA: { nama: `${AWALAN} BCA Utama`, bank: Bank.BCA, saldoAwal: 50_000_000 },
  MDR: { nama: `${AWALAN} Mandiri Operasional`, bank: Bank.MANDIRI, saldoAwal: 20_000_000 },
  BRI: { nama: `${AWALAN} BRI Reseller`, bank: Bank.BRI, saldoAwal: 5_000_000 },
};
const TANGGAL_SALDO_AWAL = "2026-07-01";

type Arah = "masuk" | "keluar";
interface Baris {
  rek: KunciRek;
  tgl: string;
  kode: string;
  ket: string;
  arah: Arah;
  nominal: number;
  catatan?: string;
}

const t = (
  rek: KunciRek,
  tgl: string,
  kode: string,
  ket: string,
  arah: Arah,
  nominal: number,
  catatan?: string
): Baris => ({ rek, tgl, kode, ket, arah, nominal, catatan });

const DATA: Baris[] = [
  // ── Modal & prive ──
  t("BCA", "2026-07-01", "300", "SETORAN MODAL PEMILIK", "masuk", 25_000_000, "tambahan modal usaha"),
  t("BCA", "2026-08-14", "301", "PRIVE PEMILIK", "keluar", 5_000_000),
  t("BCA", "2026-09-10", "301", "PRIVE PEMILIK", "keluar", 5_000_000),

  // ── Pinjaman ──
  t("MDR", "2026-07-05", "703", "PENCAIRAN PINJAMAN MODAL KERJA BANK", "masuk", 20_000_000),
  t("MDR", "2026-09-05", "703", "CICILAN POKOK PINJAMAN BANK", "keluar", 5_000_000),
  t("BCA", "2026-08-02", "702", "PINJAMAN DARI KAS INTERNAL", "masuk", 10_000_000),
  t("BCA", "2026-09-20", "702", "PENGEMBALIAN PINJAMAN INTERNAL", "keluar", 4_000_000),

  // ── Pindah dana antar rekening (masuk & keluar saling meniadakan) ──
  t("BCA", "2026-07-04", "10101", "TRSF KE MANDIRI OPERASIONAL", "keluar", 15_000_000),
  t("MDR", "2026-07-04", "10101", "TRSF DARI BCA UTAMA", "masuk", 15_000_000),
  t("BCA", "2026-07-06", "10101", "TRSF KE BRI RESELLER", "keluar", 3_000_000),
  t("BRI", "2026-07-06", "10101", "TRSF DARI BCA UTAMA", "masuk", 3_000_000),
  t("BCA", "2026-08-04", "10101", "TRSF KE MANDIRI OPERASIONAL", "keluar", 12_000_000),
  t("MDR", "2026-08-04", "10101", "TRSF DARI BCA UTAMA", "masuk", 12_000_000),
  t("BCA", "2026-09-03", "10101", "TRSF KE MANDIRI OPERASIONAL", "keluar", 10_000_000),
  t("MDR", "2026-09-03", "10101", "TRSF DARI BCA UTAMA", "masuk", 10_000_000),
  t("BCA", "2026-08-30", "102", "TARIK TUNAI UNTUK KAS KECIL", "keluar", 2_000_000),

  // ── Penjualan (payout marketplace) ──
  t("BCA", "2026-07-03", "402", "PAYOUT SHOPEE", "masuk", 18_500_000),
  t("BCA", "2026-07-10", "402", "PAYOUT SHOPEE", "masuk", 22_300_000),
  t("BCA", "2026-07-17", "402", "PAYOUT SHOPEE", "masuk", 19_800_000),
  t("BCA", "2026-07-24", "402", "PAYOUT SHOPEE", "masuk", 24_100_000),
  t("BCA", "2026-07-31", "402", "PAYOUT SHOPEE", "masuk", 21_700_000),
  t("BCA", "2026-08-07", "402", "PAYOUT SHOPEE", "masuk", 23_400_000),
  t("BCA", "2026-08-14", "402", "PAYOUT SHOPEE", "masuk", 26_900_000),
  t("BCA", "2026-08-21", "402", "PAYOUT SHOPEE", "masuk", 25_200_000),
  t("BCA", "2026-08-28", "402", "PAYOUT SHOPEE", "masuk", 27_800_000),
  t("BCA", "2026-08-31", "402", "PAYOUT SHOPEE", "masuk", 21_500_000),
  t("BCA", "2026-09-04", "402", "PAYOUT SHOPEE", "masuk", 28_600_000),
  t("BCA", "2026-09-11", "402", "PAYOUT SHOPEE", "masuk", 30_200_000),
  t("BCA", "2026-09-18", "402", "PAYOUT SHOPEE", "masuk", 27_400_000),
  t("BCA", "2026-09-25", "402", "PAYOUT SHOPEE", "masuk", 31_900_000),
  t("BCA", "2026-10-02", "402", "PAYOUT SHOPEE", "masuk", 20_100_000),
  t("MDR", "2026-07-12", "407", "PAYOUT TIKTOK SHOP", "masuk", 8_400_000),
  t("MDR", "2026-07-26", "407", "PAYOUT TIKTOK SHOP", "masuk", 9_200_000),
  t("MDR", "2026-08-09", "407", "PAYOUT TIKTOK SHOP", "masuk", 10_100_000),
  t("MDR", "2026-08-23", "407", "PAYOUT TIKTOK SHOP", "masuk", 11_300_000),
  t("MDR", "2026-09-13", "407", "PAYOUT TIKTOK SHOP", "masuk", 12_600_000),
  t("MDR", "2026-09-27", "407", "PAYOUT TIKTOK SHOP", "masuk", 13_400_000),
  t("MDR", "2026-10-05", "407", "PAYOUT TIKTOK SHOP", "masuk", 6_500_000),
  t("BCA", "2026-07-20", "403", "PAYOUT LAZADA", "masuk", 2_400_000),
  t("BCA", "2026-08-18", "403", "PAYOUT LAZADA", "masuk", 2_100_000),
  t("BCA", "2026-09-17", "403", "PAYOUT LAZADA", "masuk", 1_900_000),
  t("BRI", "2026-07-15", "409", "SETORAN JNT VIP", "masuk", 3_150_000),
  t("BRI", "2026-08-15", "409", "SETORAN JNT VIP", "masuk", 4_200_000),
  t("BRI", "2026-09-15", "409", "SETORAN JNT VIP", "masuk", 4_800_000),
  t("BRI", "2026-08-20", "408", "TRSF PENJUALAN SAP", "masuk", 2_750_000),
  t("BRI", "2026-09-20", "408", "TRSF PENJUALAN SAP", "masuk", 3_300_000),
  t("BCA", "2026-07-20", "401", "REFUND PEMBELI", "keluar", 450_000),
  t("BCA", "2026-08-18", "401", "REFUND PEMBELI", "keluar", 780_000),
  t("BCA", "2026-09-22", "401", "REFUND PEMBELI", "keluar", 620_000),
  t("BCA", "2026-07-31", "405", "BUNGA TABUNGAN", "masuk", 1_452.08),
  t("BCA", "2026-08-31", "405", "BUNGA TABUNGAN", "masuk", 1_688.4),
  t("BCA", "2026-09-30", "405", "BUNGA TABUNGAN", "masuk", 1_731.15),

  // ── Pembelian ke vendor ──
  t("BCA", "2026-07-02", "501", "TRSF KE VENDOR ARIF", "keluar", 12_000_000),
  t("BCA", "2026-07-16", "501", "TRSF KE VENDOR ARIF", "keluar", 9_500_000),
  t("BCA", "2026-08-03", "501", "TRSF KE VENDOR ARIF", "keluar", 13_200_000),
  t("BCA", "2026-08-17", "501", "TRSF KE VENDOR ARIF", "keluar", 10_400_000),
  t("BCA", "2026-09-02", "501", "TRSF KE VENDOR ARIF", "keluar", 14_000_000),
  t("BCA", "2026-09-16", "501", "TRSF KE VENDOR ARIF", "keluar", 11_800_000),
  t("BCA", "2026-10-04", "501", "TRSF KE VENDOR ARIF", "keluar", 8_000_000),
  t("BCA", "2026-07-09", "502", "TRSF KE VENDOR FAHMI", "keluar", 6_200_000),
  t("BCA", "2026-08-10", "502", "TRSF KE VENDOR FAHMI", "keluar", 7_100_000),
  t("BCA", "2026-09-09", "502", "TRSF KE VENDOR FAHMI", "keluar", 7_800_000),
  t("BCA", "2026-07-23", "508", "TRSF KE VENDOR ZANEVA", "keluar", 4_500_000),
  t("BCA", "2026-08-24", "508", "TRSF KE VENDOR ZANEVA", "keluar", 5_200_000),
  t("BCA", "2026-09-23", "508", "TRSF KE VENDOR ZANEVA", "keluar", 5_600_000),
  t("BCA", "2026-07-30", "500", "ONGKOS ANGKUT BARANG MASUK", "keluar", 350_000),
  t("BCA", "2026-08-30", "500", "ONGKOS ANGKUT BARANG MASUK", "keluar", 420_000),
  t("BCA", "2026-09-30", "500", "ONGKOS ANGKUT BARANG MASUK", "keluar", 460_000),

  // ── Beban operasional ──
  t("MDR", "2026-07-25", "601", "GAJI KARYAWAN JULI", "keluar", 15_000_000),
  t("MDR", "2026-08-25", "601", "GAJI KARYAWAN AGUSTUS", "keluar", 15_000_000),
  t("MDR", "2026-09-25", "601", "GAJI KARYAWAN SEPTEMBER", "keluar", 16_500_000),
  t("MDR", "2026-07-01", "604", "SEWA GEDUNG", "keluar", 3_000_000),
  t("MDR", "2026-08-01", "604", "SEWA GEDUNG", "keluar", 3_000_000),
  t("MDR", "2026-09-01", "604", "SEWA GEDUNG", "keluar", 3_000_000),
  t("MDR", "2026-10-01", "604", "SEWA GEDUNG", "keluar", 3_000_000),
  t("MDR", "2026-07-08", "606", "TAGIHAN LISTRIK & INTERNET", "keluar", 1_250_000),
  t("MDR", "2026-08-08", "606", "TAGIHAN LISTRIK & INTERNET", "keluar", 1_310_000),
  t("MDR", "2026-09-08", "606", "TAGIHAN LISTRIK & INTERNET", "keluar", 1_280_000),
  t("BCA", "2026-07-06", "60902", "TOP UP IKLAN SHOPEE", "keluar", 2_000_000),
  t("BCA", "2026-07-13", "60902", "TOP UP IKLAN SHOPEE", "keluar", 2_500_000),
  t("BCA", "2026-07-20", "60902", "TOP UP IKLAN SHOPEE", "keluar", 2_200_000),
  t("BCA", "2026-07-27", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_000_000),
  t("BCA", "2026-08-03", "60902", "TOP UP IKLAN SHOPEE", "keluar", 2_800_000),
  t("BCA", "2026-08-10", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_100_000),
  t("BCA", "2026-08-17", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_300_000),
  t("BCA", "2026-08-24", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_500_000),
  t("BCA", "2026-08-31", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_200_000),
  t("BCA", "2026-09-07", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_600_000),
  t("BCA", "2026-09-14", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_900_000),
  t("BCA", "2026-09-21", "60902", "TOP UP IKLAN SHOPEE", "keluar", 3_700_000),
  t("BCA", "2026-09-28", "60902", "TOP UP IKLAN SHOPEE", "keluar", 4_100_000),
  t("BCA", "2026-10-03", "60902", "TOP UP IKLAN SHOPEE", "keluar", 2_500_000),
  t("MDR", "2026-07-14", "60901", "PEMBAYARAN IKLAN FACEBOOK", "keluar", 1_500_000),
  t("MDR", "2026-08-14", "60901", "PEMBAYARAN IKLAN FACEBOOK", "keluar", 1_750_000),
  t("MDR", "2026-09-14", "60901", "PEMBAYARAN IKLAN FACEBOOK", "keluar", 1_900_000),
  t("MDR", "2026-07-28", "613", "BIAYA PENGIRIMAN EKSPEDISI", "keluar", 2_800_000),
  t("MDR", "2026-08-28", "613", "BIAYA PENGIRIMAN EKSPEDISI", "keluar", 3_300_000),
  t("MDR", "2026-09-28", "613", "BIAYA PENGIRIMAN EKSPEDISI", "keluar", 3_700_000),
  t("BRI", "2026-07-31", "603", "KOMISI RESELLER JULI", "keluar", 1_200_000),
  t("BRI", "2026-08-31", "603", "KOMISI RESELLER AGUSTUS", "keluar", 1_450_000),
  t("BRI", "2026-09-30", "603", "KOMISI RESELLER SEPTEMBER", "keluar", 1_600_000),
  t("MDR", "2026-07-31", "605", "CATERING KARYAWAN", "keluar", 1_200_000),
  t("MDR", "2026-08-31", "605", "CATERING KARYAWAN", "keluar", 1_350_000),
  t("MDR", "2026-09-30", "605", "CATERING KARYAWAN", "keluar", 1_400_000),
  t("MDR", "2026-08-12", "62002", "PERPANJANG FITUR APLIKASI", "keluar", 750_000),
  t("MDR", "2026-09-18", "60701", "PAJAK MOTOR OPERASIONAL", "keluar", 380_000),
  t("MDR", "2026-09-30", "607", "SETOR PAJAK", "keluar", 2_150_000),
  t("BCA", "2026-07-31", "611", "BIAYA ADM BULANAN", "keluar", 11_000),
  t("BCA", "2026-08-31", "611", "BIAYA ADM BULANAN", "keluar", 11_000),
  t("BCA", "2026-09-30", "611", "BIAYA ADM BULANAN", "keluar", 11_000),
  t("MDR", "2026-07-31", "611", "BIAYA ADM BULANAN", "keluar", 6_500),
  t("MDR", "2026-08-31", "611", "BIAYA ADM BULANAN", "keluar", 6_500),
  t("MDR", "2026-09-30", "611", "BIAYA ADM BULANAN", "keluar", 6_500),
  t("BCA", "2026-07-31", "612", "PAJAK BUNGA TABUNGAN", "keluar", 290.42),
  t("BCA", "2026-08-31", "612", "PAJAK BUNGA TABUNGAN", "keluar", 337.68),
  t("BCA", "2026-09-30", "612", "PAJAK BUNGA TABUNGAN", "keluar", 346.23),

  // ── Aset modal kerja, deposit, dan kewajiban ──
  t("BCA", "2026-08-05", "103", "PEMBELIAN STOK BAHAN BAKU", "keluar", 15_000_000, "stok untuk 2 bulan"),
  t("BCA", "2026-08-20", "104", "PIUTANG RESELLER", "keluar", 3_000_000),
  t("BCA", "2026-09-25", "104", "PELUNASAN SEBAGIAN PIUTANG RESELLER", "masuk", 1_500_000),
  t("BCA", "2026-07-08", "10401", "DEPOSIT SAP", "keluar", 5_000_000),
  t("BCA", "2026-08-12", "10402", "DEPOSIT MENGANTAR", "keluar", 3_000_000),
  t("BCA", "2026-07-22", "207", "DEPOSIT CUSTOMER PT MAJU", "masuk", 2_500_000),
  t("BCA", "2026-09-26", "207", "PENGEMBALIAN DEPOSIT CUSTOMER", "keluar", 1_000_000),
  t("BCA", "2026-08-25", "900", "TOP UP SALDO IKLAN SHOPEE", "keluar", 5_000_000),
];

/** Satu transaksi split: tarik tunai ATM dipecah ke beberapa kode akun. */
const SPLIT = {
  rek: "BCA" as KunciRek,
  tgl: "2026-09-12",
  ket: "TARIK TUNAI ATM",
  nominal: 2_500_000,
  rincian: [
    { kode: "602", nominal: 1_000_000, ket: "komisi admin" },
    { kode: "605", nominal: 1_000_000, ket: "catering" },
    { kode: "621", nominal: 500_000, ket: "transport" },
  ],
};

async function hapusDummy() {
  const rekening = await prisma.rekening.findMany({
    where: { nama: { startsWith: AWALAN } },
    select: { id: true },
  });
  const ids = rekening.map((r) => r.id);
  if (ids.length === 0) return { rekening: 0, transaksi: 0 };

  // Rincian ikut terhapus otomatis (onDelete: Cascade)
  const transaksi = await prisma.transaksi.deleteMany({ where: { rekeningId: { in: ids } } });
  await prisma.rekening.deleteMany({ where: { id: { in: ids } } });
  return { rekening: ids.length, transaksi: transaksi.count };
}

async function buatDummy() {
  const admin = await prisma.user.findFirst({ where: { role: "OWNER" }, orderBy: { createdAt: "asc" } });
  if (!admin) throw new Error("Belum ada user OWNER. Jalankan `npx prisma db seed` dulu.");

  const kode = await prisma.kodeAkun.findMany({ select: { id: true, kode: true } });
  const idKode = (k: string) => {
    const hit = kode.find((x) => x.kode === k);
    if (!hit) throw new Error(`Kode akun ${k} tidak ada di database. Jalankan seed dulu.`);
    return hit.id;
  };

  const dihapus = await hapusDummy();
  if (dihapus.rekening > 0) {
    console.log(`Data dummy lama dihapus: ${dihapus.rekening} rekening, ${dihapus.transaksi} transaksi`);
  }

  const ringkasan = await prisma.$transaction(
    async (tx) => {
      const idRek = {} as Record<KunciRek, string>;
      for (const key of Object.keys(REKENING) as KunciRek[]) {
        const r = REKENING[key];
        const dibuat = await tx.rekening.create({
          data: {
            nama: r.nama,
            bank: r.bank,
            saldoAwal: new Prisma.Decimal(r.saldoAwal),
            tanggalSaldoAwal: new Date(`${TANGGAL_SALDO_AWAL}T00:00:00.000Z`),
          },
        });
        idRek[key] = dibuat.id;
      }

      const urutan: Record<KunciRek, number> = { BCA: 0, MDR: 0, BRI: 0 };
      const data: Prisma.TransaksiCreateManyInput[] = [];

      const semua: (Baris & { split?: boolean })[] = [
        ...DATA,
        {
          rek: SPLIT.rek,
          tgl: SPLIT.tgl,
          kode: "",
          ket: SPLIT.ket,
          arah: "keluar" as Arah,
          nominal: SPLIT.nominal,
          split: true,
        },
      ].sort((a, b) => a.tgl.localeCompare(b.tgl));

      for (const b of semua) {
        const masuk = b.arah === "masuk" ? b.nominal : 0;
        const keluar = b.arah === "keluar" ? b.nominal : 0;
        data.push({
          rekeningId: idRek[b.rek],
          kodeAkunId: b.split ? null : idKode(b.kode),
          tanggal: new Date(`${b.tgl}T00:00:00.000Z`),
          urutanInput: ++urutan[b.rek],
          keterangan: b.ket,
          uangMasuk: new Prisma.Decimal(masuk),
          uangKeluar: new Prisma.Decimal(keluar),
          saldo: new Prisma.Decimal(0),
          catatan: b.catatan ?? null,
          statusKode: StatusKode.DIKONFIRMASI,
          sumber: Sumber.SCREENSHOT,
          yakin: true,
          dedupeHash: buatDedupeHash({
            tanggalIso: b.tgl,
            uangMasuk: masuk,
            uangKeluar: keluar,
            keterangan: b.ket,
          }),
          createdById: admin.id,
        });
      }

      await tx.transaksi.createMany({ data });

      const indukSplit = await tx.transaksi.findFirstOrThrow({
        where: {
          rekeningId: idRek[SPLIT.rek],
          keterangan: SPLIT.ket,
          tanggal: new Date(`${SPLIT.tgl}T00:00:00.000Z`),
        },
      });
      await tx.transaksiRincian.createMany({
        data: SPLIT.rincian.map((r, i) => ({
          transaksiId: indukSplit.id,
          kodeAkunId: idKode(r.kode),
          nominal: new Prisma.Decimal(r.nominal),
          keterangan: r.ket,
          urutan: i,
        })),
      });

      for (const id of Object.values(idRek)) await hitungUlangSaldo(tx, id);

      const hasil = [];
      for (const key of Object.keys(REKENING) as KunciRek[]) {
        const terakhir = await tx.transaksi.findFirst({
          where: { rekeningId: idRek[key] },
          orderBy: [{ tanggal: "desc" }, { urutanInput: "desc" }],
        });
        const minimum = await tx.transaksi.aggregate({
          where: { rekeningId: idRek[key] },
          _min: { saldo: true },
          _count: true,
        });
        hasil.push({
          nama: REKENING[key].nama,
          transaksi: minimum._count,
          saldoAkhir: Number(terakhir?.saldo ?? 0),
          saldoTerendah: Number(minimum._min.saldo ?? 0),
        });
      }
      return hasil;
    },
    { timeout: 120_000, maxWait: 30_000 }
  );

  console.log("\nData dummy dibuat:");
  for (const r of ringkasan) {
    console.log(
      `  ${r.nama.padEnd(34)} ${String(r.transaksi).padStart(3)} transaksi | saldo akhir ${r.saldoAkhir.toLocaleString("id-ID")} | saldo terendah ${r.saldoTerendah.toLocaleString("id-ID")}`
    );
  }
  const negatif = ringkasan.filter((r) => r.saldoTerendah < 0);
  if (negatif.length > 0) {
    console.warn("\nPERINGATAN: ada rekening dummy yang saldonya sempat negatif:", negatif.map((r) => r.nama));
  }
}

async function main() {
  if (process.argv.includes("--hapus")) {
    const h = await hapusDummy();
    console.log(`Data dummy dihapus: ${h.rekening} rekening, ${h.transaksi} transaksi`);
    return;
  }
  await buatDummy();
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
