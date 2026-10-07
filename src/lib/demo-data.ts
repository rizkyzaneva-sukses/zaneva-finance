/**
 * Data demo (dummy) + Reset Data — dipakai halaman OWNER "Data & Demo".
 *
 * Tiga operasi:
 *   - isiDummy()    : buat data contoh lengkap untuk SEMUA fitur & SEMUA brand.
 *   - hapusDummy()  : hapus HANYA data contoh (yang bertanda [DUMMY]).
 *   - resetData()   : hapus seluruh data operasional (brand, rekening, transaksi,
 *                     dokumen, stok, alokasi, log). User & Kode Akun dipertahankan.
 *
 * Penandaan supaya bisa dibedakan dari data asli:
 *   - Brand & Rekening  : nama diawali "[DUMMY]"
 *   - Produk            : SKU diawali "[DUMMY]"
 *   - Stok Opname       : catatan diawali "[DUMMY]"
 *   - Dokumen           : namaFile diawali "[DUMMY]" (atau menempel ke rekening dummy)
 *   - Periode alokasi   : disetujui oleh user demo ([DUMMY] ...)
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Bank, JenisSo, Role, StatusAcc, StatusKode, Sumber } from "@/generated/prisma/enums";
import { buatDedupeHash, hitungUlangSaldo } from "@/lib/rekap";
import { kunciSku } from "@/lib/produk";
import { buatIdDokumen, ekstensiDariTipe, folderDokumen, hapusFileDisk, simpanFile } from "@/lib/dokumen";

export const MARK = "[DUMMY]";
const OPSI_TX = { timeout: 120_000, maxWait: 30_000 };

// ─────────────────────────────────────────────────────────────
// Konfigurasi data contoh
// ─────────────────────────────────────────────────────────────

interface ProdukCfg {
  nama: string;
  hpp: number;
  stok: number[]; // stok pada tiap SO (awal, bulan-2, bulan-1)
}

interface BrandCfg {
  nama: string;
  kunci: string;
  /** Kode pendek unik untuk SKU produk (mis. ZVM). */
  kode: string;
  bank: Bank;
  rekNama: string;
  saldoAwal: number;
  penjualan: { kode: string; label: string; nilai: number[] };
  pembelian: { kode: string; label: string; nilai: number[] };
  gaji: number;
  sewa: number;
  iklan: { kode: string; label: string; nilai: number[] };
  produk: ProdukCfg[];
}

const BRANDS: BrandCfg[] = [
  {
    nama: `${MARK} Zaneva Muslimah`,
    kunci: "zanevamuslimahdemo",
    kode: "ZVM",
    bank: Bank.BCA,
    rekNama: `${MARK} BCA Zaneva Muslimah`,
    saldoAwal: 40_000_000,
    penjualan: { kode: "402", label: "PAYOUT SHOPEE", nilai: [12_000_000, 15_000_000, 18_000_000] },
    pembelian: { kode: "501", label: "TRSF VENDOR ARIF", nilai: [6_000_000, 7_000_000] },
    gaji: 6_000_000,
    sewa: 2_500_000,
    iklan: { kode: "60902", label: "TOP UP IKLAN SHOPEE", nilai: [1_500_000, 1_800_000] },
    produk: [
      { nama: "Gamis Syar'i Adrea", hpp: 165_000, stok: [120, 96, 78] },
      { nama: "Hijab Instant Voal", hpp: 55_000, stok: [240, 210, 185] },
      { nama: "Rok Plisket Lebar", hpp: 98_000, stok: [90, 74, 61] },
      { nama: "Kemeja Basic Linen", hpp: 110_000, stok: [70, 55, 44] },
      { nama: "Mukena Set Dewasa", hpp: 145_000, stok: [60, 48, 35] },
      { nama: "Cardigan Rajut", hpp: 120_000, stok: [80, 66, 52] },
    ],
  },
  {
    nama: `${MARK} Zaneva Kids`,
    kunci: "zanevakidsdemo",
    kode: "ZKD",
    bank: Bank.MANDIRI,
    rekNama: `${MARK} Mandiri Zaneva Kids`,
    saldoAwal: 18_000_000,
    penjualan: { kode: "407", label: "PAYOUT TIKTOK SHOP", nilai: [8_000_000, 9_500_000, 11_000_000] },
    pembelian: { kode: "502", label: "TRSF VENDOR FAHMI", nilai: [4_000_000, 4_500_000] },
    gaji: 4_500_000,
    sewa: 2_000_000,
    iklan: { kode: "60904", label: "IKLAN TIKTOK", nilai: [1_000_000, 1_200_000] },
    produk: [
      { nama: "Setelan Anak Laki", hpp: 85_000, stok: [90, 72, 60] },
      { nama: "Dress Anak Perempuan", hpp: 95_000, stok: [80, 64, 50] },
      { nama: "Kaos Kids Motif", hpp: 45_000, stok: [150, 128, 104] },
      { nama: "Celana Joger Anak", hpp: 60_000, stok: [100, 82, 68] },
      { nama: "Jaket Hoodie Kids", hpp: 110_000, stok: [55, 42, 33] },
      { nama: "Piyama Anak", hpp: 70_000, stok: [70, 58, 44] },
    ],
  },
  {
    nama: `${MARK} Zaneva Hijab`,
    kunci: "zanevahijabdemo",
    kode: "ZHJ",
    bank: Bank.BRI,
    rekNama: `${MARK} BRI Zaneva Hijab`,
    saldoAwal: 12_000_000,
    penjualan: { kode: "406", label: "PAYOUT TOKOPEDIA", nilai: [5_000_000, 6_000_000, 7_000_000] },
    pembelian: { kode: "503", label: "TRSF VENDOR DIMAS", nilai: [3_000_000, 3_500_000] },
    gaji: 3_500_000,
    sewa: 1_800_000,
    iklan: { kode: "60903", label: "IKLAN LAZADA", nilai: [800_000, 1_000_000] },
    produk: [
      { nama: "Pashmina Ceruty", hpp: 60_000, stok: [200, 172, 150] },
      { nama: "Hijab Bergo Instan", hpp: 42_000, stok: [260, 230, 198] },
      { nama: "Khimar Syar'i", hpp: 130_000, stok: [75, 60, 47] },
      { nama: "Hijab Sport", hpp: 50_000, stok: [110, 92, 75] },
      { nama: "Bergo Kaos Anak", hpp: 35_000, stok: [180, 155, 132] },
      { nama: "Scarf Premium", hpp: 88_000, stok: [95, 78, 62] },
    ],
  },
];

/** Rekening operasional pusat (bukan milik brand manapun) — menampung beban kantor. */
const PUSAT = { nama: `${MARK} BCA Operasional Pusat`, bank: Bank.BCA, saldoAwal: 30_000_000 };
/** Kas kecil (petty cash). */
const KAS = { nama: `${MARK} Kas Kecil Kantor`, bank: Bank.PETTY_CASH, saldoAwal: 3_000_000 };

// ─────────────────────────────────────────────────────────────
// Utilitas
// ─────────────────────────────────────────────────────────────

function daftarBulan(): { yy: number; mm: number }[] {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const hasil: { yy: number; mm: number }[] = [];
  for (let i = 2; i >= 0; i--) {
    let mm = m - i;
    let yy = y;
    if (mm <= 0) {
      mm += 12;
      yy -= 1;
    }
    hasil.push({ yy, mm });
  }
  return hasil;
}

const iso = (yy: number, mm: number, dd: number) =>
  `${yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;

/** 1x1 PNG transparan — isi file dokumen contoh supaya bisa diunduh. */
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60Y89k8AAAAASUVORK5CYII=",
  "base64"
);
const PDF_MIN = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n");

// ─────────────────────────────────────────────────────────────
// Hapus data dummy
// ─────────────────────────────────────────────────────────────

export async function hapusDummy() {
  const [brands, reks, users] = await Promise.all([
    prisma.brand.findMany({ where: { nama: { startsWith: MARK } }, select: { id: true } }),
    prisma.rekening.findMany({ where: { nama: { startsWith: MARK } }, select: { id: true } }),
    prisma.user.findMany({ where: { nama: { startsWith: MARK } }, select: { id: true } }),
  ]);
  const brandIds = brands.map((b) => b.id);
  const rekIds = reks.map((r) => r.id);
  const userIds = users.map((u) => u.id);

  // Dokumen + filenya
  const dok = await prisma.dokumenMutasi.findMany({
    where: { OR: [{ rekeningId: { in: rekIds } }, { namaFile: { startsWith: MARK } }] },
    select: { id: true, tipe: true },
  });
  for (const d of dok) await hapusFileDisk(d.id, ekstensiDariTipe(d.tipe)).catch(() => {});
  await prisma.dokumenMutasi.deleteMany({ where: { id: { in: dok.map((d) => d.id) } } });

  const transaksi = await prisma.transaksi.deleteMany({ where: { rekeningId: { in: rekIds } } });
  const so = await prisma.stokOpname.deleteMany({ where: { catatan: { startsWith: MARK } } });
  const produk = await prisma.produk.deleteMany({
    where: { OR: [{ brandId: { in: brandIds } }, { sku: { startsWith: MARK } }] },
  });
  await prisma.rekening.deleteMany({ where: { id: { in: rekIds } } });

  const periode = await prisma.periodeLaba.findMany({ where: { disetujuiOlehId: { in: userIds } }, select: { id: true } });
  const periodeIds = periode.map((p) => p.id);
  await prisma.distribusiAlokasi.deleteMany({ where: { periodeId: { in: periodeIds } } });
  await prisma.periodeLaba.deleteMany({ where: { id: { in: periodeIds } } });

  await prisma.userBrand.deleteMany({
    where: { OR: [{ brandId: { in: brandIds } }, { userId: { in: userIds } }] },
  });
  await prisma.brand.deleteMany({ where: { id: { in: brandIds } } });
  const log = await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });

  return {
    brand: brandIds.length,
    rekening: rekIds.length,
    transaksi: transaksi.count,
    dokumen: dok.length,
    stokOpname: so.count,
    produk: produk.count,
    periode: periodeIds.length,
    pengguna: userIds.length,
    log: log.count,
  };
}

// ─────────────────────────────────────────────────────────────
// Reset seluruh data operasional (user & kode akun dipertahankan)
// ─────────────────────────────────────────────────────────────

export async function resetData() {
  // Hapus file dokumen di disk dulu
  try {
    const dir = folderDokumen();
    const { readdir, rm } = await import("node:fs/promises");
    const berkas = await readdir(dir).catch(() => [] as string[]);
    for (const f of berkas) await rm(`${dir}/${f}`, { force: true }).catch(() => {});
  } catch {
    /* folder belumlah ada — tidak masalah */
  }

  const hasil = await prisma.$transaction(
    async (tx) => {
      const dokumen = await tx.dokumenMutasi.deleteMany({});
      const rincian = await tx.transaksiRincian.deleteMany({});
      const transaksi = await tx.transaksi.deleteMany({});
      const soItem = await tx.stokOpnameItem.deleteMany({});
      const so = await tx.stokOpname.deleteMany({});
      const distribusi = await tx.distribusiAlokasi.deleteMany({});
      const periode = await tx.periodeLaba.deleteMany({});
      const produk = await tx.produk.deleteMany({});
      const rekening = await tx.rekening.deleteMany({});
      const userBrand = await tx.userBrand.deleteMany({});
      const brand = await tx.brand.deleteMany({});
      const log = await tx.auditLog.deleteMany({});
      return {
        brand: brand.count,
        rekening: rekening.count,
        transaksi: transaksi.count,
        rincian: rincian.count,
        dokumen: dokumen.count,
        stokOpname: so.count,
        soItem: soItem.count,
        produk: produk.count,
        periode: periode.count,
        distribusi: distribusi.count,
        userBrand: userBrand.count,
        log: log.count,
      };
    },
    OPSI_TX
  );
  return hasil;
}

// ─────────────────────────────────────────────────────────────
// Isi data dummy
// ─────────────────────────────────────────────────────────────

export async function isiDummy() {
  const owner = await prisma.user.findFirst({ where: { role: Role.OWNER }, orderBy: { createdAt: "asc" } });
  if (!owner) throw new Error("Belum ada user OWNER. Jalankan seed dulu.");

  const kode = await prisma.kodeAkun.findMany({ select: { id: true, kode: true } });
  const idKode = (k: string) => {
    const hit = kode.find((x) => x.kode === k);
    if (!hit) throw new Error(`Kode akun ${k} tidak ada. Jalankan seed kode akun dulu.`);
    return hit.id;
  };

  // Bersihkan dummy lama supaya idempoten
  await hapusDummy();

  const bulan = daftarBulan();
  const pwHash = await bcrypt.hash("dummy1234", 10);

  await prisma.$transaction(
    async (tx) => {
      // ── User demo ───────────────────────────────────────────
      const demoAdmin = await tx.user.create({
        data: {
          nama: `${MARK} Finance Demo`,
          username: "demo.finance",
          passwordHash: pwHash,
          role: Role.ADMIN,
        },
      });

      // ── Rekening pusat + kas kecil ──────────────────────────
      const pusat = await tx.rekening.create({
        data: {
          nama: PUSAT.nama,
          bank: PUSAT.bank,
          saldoAwal: new Prisma.Decimal(PUSAT.saldoAwal),
          tanggalSaldoAwal: new Date(`${iso(bulan[0].yy, bulan[0].mm, 1)}T00:00:00.000Z`),
          urutan: 1,
        },
      });
      const kas = await tx.rekening.create({
        data: {
          nama: KAS.nama,
          bank: KAS.bank,
          saldoAwal: new Prisma.Decimal(KAS.saldoAwal),
          tanggalSaldoAwal: new Date(`${iso(bulan[0].yy, bulan[0].mm, 1)}T00:00:00.000Z`),
          urutan: 2,
        },
      });

      const tglMulai = new Date(`${iso(bulan[0].yy, bulan[0].mm, 1)}T00:00:00.000Z`);

      // ── Per brand: brand, rekening, produk, transaksi, SO ───
      const semuaRekeningId: string[] = [pusat.id, kas.id];

      for (const cfg of BRANDS) {
        const brand = await tx.brand.create({ data: { nama: cfg.nama, kunci: cfg.kunci } });

        // Rekening brand
        const rek = await tx.rekening.create({
          data: {
            nama: cfg.rekNama,
            bank: cfg.bank,
            saldoAwal: new Prisma.Decimal(cfg.saldoAwal),
            tanggalSaldoAwal: tglMulai,
            brandId: brand.id,
            urutan: 10,
          },
        });
        semuaRekeningId.push(rek.id);

        // Produk
        const dibuatProduk: { id: string; sku: string; hpp: number; brandId: string }[] = [];
        for (let pi = 0; pi < cfg.produk.length; pi++) {
          const p = cfg.produk[pi];
          const sku = `${MARK} ${cfg.kode}-P${String(pi + 1).padStart(2, "0")}`;
          const pr = await tx.produk.create({
            data: { sku, skuKunci: kunciSku(sku), brandId: brand.id, hpp: new Prisma.Decimal(p.hpp) },
          });
          dibuatProduk.push({ id: pr.id, sku, hpp: p.hpp, brandId: brand.id });
        }

        // Transaksi: modal awal + operasional tiap bulan
        const rows: Prisma.TransaksiCreateManyInput[] = [];
        let urutan = 0;
        const push = (tgl: string, kodeAkun: string | null, ket: string, masuk: number, keluar: number, extra?: { acc?: StatusAcc; statusKode?: StatusKode; sumber?: Sumber }) => {
          rows.push({
            rekeningId: rek.id,
            kodeAkunId: kodeAkun ? idKode(kodeAkun) : null,
            tanggal: new Date(`${tgl}T00:00:00.000Z`),
            urutanInput: ++urutan,
            keterangan: ket,
            uangMasuk: new Prisma.Decimal(masuk),
            uangKeluar: new Prisma.Decimal(keluar),
            saldo: new Prisma.Decimal(0),
            statusKode: extra?.statusKode ?? StatusKode.DIKONFIRMASI,
            sumber: extra?.sumber ?? Sumber.SCREENSHOT,
            yakin: true,
            dedupeHash: buatDedupeHash({ tanggalIso: tgl, uangMasuk: masuk, uangKeluar: keluar, keterangan: ket }),
            statusAcc: extra?.acc ?? StatusAcc.DISETUJUI,
            createdById: owner.id,
          });
        };

        // Modal awal
        push(iso(bulan[0].yy, bulan[0].mm, 2), "300", "SETORAN MODAL PEMILIK", Math.round(cfg.saldoAwal * 0.5), 0);

        bulan.forEach((b, idx) => {
          // Penjualan (3x per bulan)
          cfg.penjualan.nilai.forEach((n, i) => {
            push(iso(b.yy, b.mm, 5 + i * 10), cfg.penjualan.kode, cfg.penjualan.label, n, 0);
          });
          // Pembelian vendor
          cfg.pembelian.nilai.forEach((n, i) => {
            push(iso(b.yy, b.mm, 8 + i * 12), cfg.pembelian.kode, cfg.pembelian.label, 0, n);
          });
          // Iklan (2x)
          cfg.iklan.nilai.forEach((n, i) => {
            push(iso(b.yy, b.mm, 6 + i * 13), cfg.iklan.kode, cfg.iklan.label, 0, n);
          });
          // Gaji & sewa
          push(iso(b.yy, b.mm, 25), "601", `GAJI KARYAWAN PERIODE ${b.mm}/${b.yy}`, 0, cfg.gaji);
          push(iso(b.yy, b.mm, 1), "604", "SEWA GEDUNG", 0, cfg.sewa);
          // Adm bank + pajak bunga
          push(iso(b.yy, b.mm, 28), "611", "BIAYA ADM BANK", 0, 15_000);
          // Pengisian kas dari brand ke pusat (pindah dana)
          push(iso(b.yy, b.mm, 26), "10101", "TRSF KE OPERASIONAL PUSAT", 0, 15_000_000);
          // Beberapa baris menunggu ACC pada bulan terakhir (demo alur ACC)
          if (idx === 2) {
            push(iso(b.yy, b.mm, 20), "621", "BEBAN OPERASIONAL (INPUT STAFF)", 0, 350_000, { acc: StatusAcc.MENUNGGU });
            push(iso(b.yy, b.mm, 21), "613", "ONGKOS EKSPEDISI (INPUT STAFF)", 0, 250_000, { acc: StatusAcc.MENUNGGU });
          }
        });

        await tx.transaksi.createMany({ data: rows });

        // Satu transaksi split (tarik tunai dipecah ke beberapa akun) pada bulan terakhir
        const bL = bulan[2];
        const splitTgl = iso(bL.yy, bL.mm, 12);
        const splitInduk = await tx.transaksi.create({
          data: {
            rekeningId: rek.id,
            kodeAkunId: null,
            tanggal: new Date(`${splitTgl}T00:00:00.000Z`),
            urutanInput: ++urutan,
            keterangan: "TARIK TUNAI ATM",
            uangMasuk: new Prisma.Decimal(0),
            uangKeluar: new Prisma.Decimal(1_500_000),
            saldo: new Prisma.Decimal(0),
            statusKode: StatusKode.DIKONFIRMASI,
            sumber: Sumber.SCREENSHOT,
            yakin: true,
            dedupeHash: buatDedupeHash({ tanggalIso: splitTgl, uangMasuk: 0, uangKeluar: 1_500_000, keterangan: "TARIK TUNAI ATM" }),
            createdById: owner.id,
          },
        });
        await tx.transaksiRincian.createMany({
          data: [
            { transaksiId: splitInduk.id, kodeAkunId: idKode("621"), nominal: new Prisma.Decimal(900_000), keterangan: "operasional", urutan: 0 },
            { transaksiId: splitInduk.id, kodeAkunId: idKode("605"), nominal: new Prisma.Decimal(400_000), keterangan: "konsumsi", urutan: 1 },
            { transaksiId: splitInduk.id, kodeAkunId: idKode("62103"), nominal: new Prisma.Decimal(200_000), keterangan: "photosoot", urutan: 2 },
          ],
        });

        await hitungUlangSaldo(tx, rek.id);

        // Stok opname: AWAL + 2x BULANAN
        const soDef = [
          { jenis: JenisSo.AWAL, posisi: iso(bulan[0].yy, bulan[0].mm, 1), idx: 0 },
          { jenis: JenisSo.BULANAN, posisi: iso(bulan[1].yy, bulan[1].mm, 1), idx: 1 },
          { jenis: JenisSo.BULANAN, posisi: iso(bulan[2].yy, bulan[2].mm, 1), idx: 2 },
        ];
        for (const s of soDef) {
          const items = dibuatProduk.map((p, i) => {
            const stok = cfg.produk[i].stok[s.idx];
            const nilai = stok * p.hpp;
            return { produkId: p.id, sku: p.sku, brandId: brand.id, stok, hpp: new Prisma.Decimal(p.hpp), nilai: new Prisma.Decimal(nilai) };
          });
          const totalStok = items.reduce((a, x) => a + x.stok, 0);
          const totalNilai = items.reduce((a, x) => a + Number(x.nilai), 0);
          const so = await tx.stokOpname.create({
            data: {
              jenis: s.jenis,
              tanggalInput: new Date(`${iso(bulan[Math.min(s.idx + 1, 2)].yy, bulan[Math.min(s.idx + 1, 2)].mm, 2)}T00:00:00.000Z`),
              posisiPada: new Date(`${s.posisi}T00:00:00.000Z`),
              catatan: `${MARK} Stok opname ${s.jenis} ${cfg.nama}`,
              jumlahSku: items.length,
              totalStok,
              totalNilai: new Prisma.Decimal(totalNilai),
              statusAcc: StatusAcc.DISETUJUI,
              diunggahOlehId: owner.id,
            },
          });
          await tx.stokOpnameItem.createMany({
            data: items.map((x) => ({ ...x, stokOpnameId: so.id })),
          });
        }

        // User portal demo yang dibatasi ke brand ini
        const staff = await tx.user.create({
          data: {
            nama: `${MARK} Staff ${cfg.nama.replace(MARK, "").trim()}`,
            username: `demo.${cfg.kunci.replace("demo", "")}`.slice(0, 20),
            passwordHash: pwHash,
            role: Role.STAFF,
          },
        });
        await tx.userBrand.create({ data: { userId: staff.id, brandId: brand.id } });

        // Dokumen contoh (arsip permanen) untuk rekening brand
        await buatDokumen(tx, rek.id, owner.id, `Mutasi ${cfg.bank} ${cfg.kunci}`, bulan);
      }

      // ── Transaksi rekening pusat ────────────────────────────
      const rowsPusat: Prisma.TransaksiCreateManyInput[] = [];
      let urP = 0;
      const pushP = (rekeningId: string, tgl: string, kodeAkun: string, ket: string, masuk: number, keluar: number) => {
        rowsPusat.push({
          rekeningId,
          kodeAkunId: idKode(kodeAkun),
          tanggal: new Date(`${tgl}T00:00:00.000Z`),
          urutanInput: ++urP,
          keterangan: ket,
          uangMasuk: new Prisma.Decimal(masuk),
          uangKeluar: new Prisma.Decimal(keluar),
          saldo: new Prisma.Decimal(0),
          statusKode: StatusKode.DIKONFIRMASI,
          sumber: Sumber.SCREENSHOT,
          yakin: true,
          dedupeHash: buatDedupeHash({ tanggalIso: tgl, uangMasuk: masuk, uangKeluar: keluar, keterangan: ket }),
          createdById: owner.id,
        });
      };
      pushP(pusat.id, iso(bulan[0].yy, bulan[0].mm, 2), "300", "SETORAN MODAL PUSAT", 10_000_000, 0);
      bulan.forEach((b) => {
        pushP(pusat.id, iso(b.yy, b.mm, 26), "10101", "TERIMA TRANSFER DARI BRAND", 15_000_000, 0);
        pushP(pusat.id, iso(b.yy, b.mm, 25), "601", "GAJI TIM ADMIN PUSAT", 0, 8_000_000);
        pushP(pusat.id, iso(b.yy, b.mm, 1), "604", "SEWA KANTOR PUSAT", 0, 3_000_000);
        pushP(pusat.id, iso(b.yy, b.mm, 8), "606", "TAGIHAN LISTRIK & INTERNET KANTOR", 0, 1_500_000);
        pushP(pusat.id, iso(b.yy, b.mm, 28), "611", "BIAYA ADM BANK PUSAT", 0, 20_000);
      });
      await tx.transaksi.createMany({ data: rowsPusat });
      await hitungUlangSaldo(tx, pusat.id);

      // Kas kecil
      const rowsKas: Prisma.TransaksiCreateManyInput[] = [];
      let urK = 0;
      const pushK = (tgl: string, kodeAkun: string, ket: string, masuk: number, keluar: number) => {
        rowsKas.push({
          rekeningId: kas.id,
          kodeAkunId: idKode(kodeAkun),
          tanggal: new Date(`${tgl}T00:00:00.000Z`),
          urutanInput: ++urK,
          keterangan: ket,
          uangMasuk: new Prisma.Decimal(masuk),
          uangKeluar: new Prisma.Decimal(keluar),
          saldo: new Prisma.Decimal(0),
          statusKode: StatusKode.DIKONFIRMASI,
          sumber: Sumber.MANUAL,
          yakin: true,
          dedupeHash: buatDedupeHash({ tanggalIso: tgl, uangMasuk: masuk, uangKeluar: keluar, keterangan: ket }),
          createdById: owner.id,
        });
      };
      bulan.forEach((b) => {
        pushK(iso(b.yy, b.mm, 27), "102", "TARIK TUNAI UNTUK KAS KECIL", 1_000_000, 0);
        pushK(iso(b.yy, b.mm, 15), "621", "BELI ATK & KEBUTUHAN KANTOR", 0, 450_000);
        pushK(iso(b.yy, b.mm, 22), "605", "KONSUMSI RAPAT", 0, 300_000);
      });
      await tx.transaksi.createMany({ data: rowsKas });
      await hitungUlangSaldo(tx, kas.id);

      await buatDokumen(tx, pusat.id, owner.id, "Mutasi BCA Pusat", bulan);

      // ── Tutup buku + distribusi alokasi (2 bulan terakhir) ──
      const kodeAlokasi = kode.filter((k) => ["801", "802", "803"].includes(k.kode));
      const laba = [8_500_000, 9_750_000];
      for (let i = 0; i < 2; i++) {
        const b = bulan[1 + i];
        const periode = await tx.periodeLaba.create({
          data: {
            tahun: b.yy,
            bulan: b.mm,
            labaBersih: new Prisma.Decimal(laba[i]),
            disetujuiOlehId: demoAdmin.id,
          },
        });
        const persen = [40, 35, 25];
        for (let j = 0; j < kodeAlokasi.length; j++) {
          await tx.distribusiAlokasi.create({
            data: {
              periodeId: periode.id,
              kodeAkunId: kodeAlokasi[j].id,
              persen: new Prisma.Decimal(persen[j]),
              nominal: new Prisma.Decimal(Math.round((laba[i] * persen[j]) / 100)),
              disetujuiOlehId: demoAdmin.id,
            },
          });
        }
      }

      // ── Log aktivitas contoh ────────────────────────────────
      await tx.auditLog.createMany({
        data: [
          { userId: owner.id, entitas: "Rekening", entitasId: pusat.id, aksi: "BUAT", dataBaru: { nama: PUSAT.nama } },
          { userId: owner.id, entitas: "Transaksi", entitasId: "demo-1", aksi: "BUAT", dataBaru: { ket: "Payout marketplace" } },
          { userId: demoAdmin.id, entitas: "PeriodeLaba", entitasId: "demo-periode", aksi: "BUAT", dataBaru: { laba: laba[1] } },
          { userId: demoAdmin.id, entitas: "DistribusiAlokasi", entitasId: "demo-dist", aksi: "BUAT", dataBaru: { kode: ["801", "802", "803"] } },
          { userId: owner.id, entitas: "StokOpname", entitasId: "demo-so", aksi: "BUAT", dataBaru: { jenis: "BULANAN" } },
          { userId: owner.id, entitas: "Produk", entitasId: "demo-produk", aksi: "BUAT", dataBaru: { jumlah: 18 } },
        ],
      });
    },
    OPSI_TX
  );

  return {
    brand: BRANDS.length,
    rekening: BRANDS.length + 2,
    produk: BRANDS.reduce((a, b) => a + b.produk.length, 0),
  };
}

/** Buat beberapa catatan dokumen + file kecil di disk. */
async function buatDokumen(
  tx: Prisma.TransactionClient,
  rekeningId: string,
  userId: string,
  judul: string,
  bulan: { yy: number; mm: number }[]
) {
  const pola: { tipe: string; nama: string; pdf: boolean }[] = [
    { tipe: "image/png", nama: "screenshot-mutasi-1.png", pdf: false },
    { tipe: "application/pdf", nama: "mutasi-rekening.pdf", pdf: true },
  ];
  for (let i = 0; i < bulan.length; i++) {
    const p = pola[i % pola.length];
    const id = buatIdDokumen();
    const ext = ekstensiDariTipe(p.tipe);
    const isi = p.pdf ? PDF_MIN : PNG_1PX;
    await simpanFile(id, ext, isi);
    await tx.dokumenMutasi.create({
      data: {
        id,
        rekeningId,
        namaFile: `${MARK} ${p.nama}`,
        tipe: p.tipe,
        ukuran: isi.length,
        periode: `${bulan[i].yy}-${String(bulan[i].mm).padStart(2, "0")}`,
        catatan: `${judul} — arsip permanen demo`,
        diunggahOlehId: userId,
      },
    });
  }
}
