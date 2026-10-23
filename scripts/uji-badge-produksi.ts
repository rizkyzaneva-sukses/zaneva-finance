/**
 * Uji rekonsiliasi langsung terhadap DATABASE PRODUKSI.
 *
 * Aturan yang diuji: badge "beda dgn bank" hanya dipasang kalau net satu hari
 * TERBUKTI beda dengan net mutasi bank. Syarat bukti:
 *   - SETIAP baris hari itu punya saldoBank, dan
 *   - rantai saldo utuh (1 titik awal, 1 titik akhir).
 *
 * Hari yang datanya tidak lengkap dilewati (tidak divonis) — lebih baik diam
 * daripada menuduh salah.
 *
 * Dijalankan di dalam container: npx tsx scripts/uji-badge-produksi.ts
 */
import { prisma } from "../src/lib/prisma";
import { analisaHari, tentukanBadge } from "../src/lib/rekonsiliasi";
import { Prisma } from "../src/generated/prisma/client";

const TOL = new Prisma.Decimal("1");

async function main() {
  const rekening = await prisma.rekening.findMany({
    select: { id: true, nomorRekening: true, bank: true, saldoAwal: true },
    orderBy: { urutan: "asc" },
  });

  let badgeLama = 0;
  let badgeBaru = 0;
  let hariSah = 0;
  let hariTakSah = 0;
  const beda: string[] = [];

  for (const rek of rekening) {
    const baris = await prisma.transaksi.findMany({
      where: { rekeningId: rek.id },
      select: {
        id: true,
        tanggal: true,
        urutanInput: true,
        uangMasuk: true,
        uangKeluar: true,
        saldo: true,
        saldoBank: true,
        sumber: true,
      },
      orderBy: [{ tanggal: "asc" }, { urutanInput: "asc" }],
    });
    if (baris.length === 0) continue;

    const perTanggal = new Map<string, typeof baris>();
    for (const t of baris) {
      const kunci = t.tanggal.toISOString().slice(0, 10);
      const d = perTanggal.get(kunci);
      if (d) d.push(t);
      else perTanggal.set(kunci, [t]);
    }

    for (const kunci of [...perTanggal.keys()].sort()) {
      const daftar = [...perTanggal.get(kunci)!].sort((a, b) => a.urutanInput - b.urutanInput);

      // Cara LAMA: tiap baris dibandingkan saldo berjalan vs saldoBank-nya.
      badgeLama += daftar.filter(
        (t) => t.saldoBank !== null && t.saldo.minus(t.saldoBank).abs().greaterThanOrEqualTo(TOL)
      ).length;

      const analisa = analisaHari(daftar);
      const baru = tentukanBadge(daftar, analisa, TOL);
      badgeBaru += baru.size;

      if (!analisa.sah) {
        hariTakSah += 1;
        continue;
      }
      hariSah += 1;
      if (baru.size > 0) {
        beda.push(
          `${rek.nomorRekening} ${kunci}: net sistem=${analisa.netSistem} net bank=${analisa.netBank} selisih=${analisa.selisih}`
        );
      }
    }
  }

  console.log("=== UJI BADGE TERHADAP DB PRODUKSI ===");
  console.log(`Rekening                   : ${rekening.length}`);
  console.log("");
  console.log(`Badge cara LAMA (per baris): ${badgeLama}`);
  console.log(`Badge cara BARU (per hari) : ${badgeBaru}`);
  console.log(`Turun                      : ${badgeLama - badgeBaru}`);
  console.log("");
  console.log(`Hari terbukti (data lengkap): ${hariSah}`);
  console.log(`Hari dilewati (tak lengkap) : ${hariTakSah}`);
  if (beda.length > 0) {
    console.log("\nHari yang TERBUKTI beda:");
    for (const b of beda) console.log("  " + b);
  } else {
    console.log("\nTidak ada hari yang terbukti beda. Semua net hari cocok dengan bank.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
