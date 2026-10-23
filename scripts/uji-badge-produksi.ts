/**
 * Uji rekonsiliasi langsung terhadap DATABASE PRODUKSI.
 *
 * Bedanya dengan uji-rekonsiliasi.ts (yang pakai CSV): uji ini membaca tabel
 * Transaksi & Rekening yang benar-benar dipakai aplikasi, lalu membandingkan
 * jumlah badge "beda dgn bank" cara lama vs cara baru.
 *
 * Dijalankan di dalam container: npx tsx scripts/uji-badge-produksi.ts
 */
import { prisma } from "../src/lib/prisma";
import { analisaHari, tentukanBadge } from "../src/lib/rekonsiliasi";
import { Prisma } from "../src/generated/prisma/client";
const TOL = new Prisma.Decimal("1");

async function main() {
  const rekening = await prisma.rekening.findMany({
    select: { id: true, bank: true, nomorRekening: true, saldoAwal: true },
    orderBy: { urutan: "asc" },
  });

  let badgeLama = 0;
  let badgeBaru = 0;
  let hariTotal = 0;
  let hariBeda = 0;
  const rincianHariBeda: string[] = [];

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

    let berjalan = rek.saldoAwal;
    for (const kunci of [...perTanggal.keys()].sort()) {
      const daftar = [...perTanggal.get(kunci)!].sort((a, b) => a.urutanInput - b.urutanInput);
      const sebelum = berjalan;
      berjalan = daftar.reduce(
        (a, t) => a.plus(t.uangMasuk).minus(t.uangKeluar),
        sebelum
      );

      const lama = daftar.filter(
        (t) =>
          t.saldoBank !== null &&
          t.saldo.minus(t.saldoBank).abs().greaterThanOrEqualTo(TOL)
      );
      badgeLama += lama.length;

      const analisa = analisaHari(daftar, sebelum);
      const baru = tentukanBadge(daftar, analisa, TOL);
      badgeBaru += baru.size;

      if (analisa.adaSaldoBank) {
        hariTotal += 1;
        if (baru.size > 0) {
          hariBeda += 1;
          rincianHariBeda.push(
            `${rek.nomorRekening} ${kunci} n=${daftar.length} sistem=${analisa.saldoAkhirSistem} bank=${analisa.saldoAkhirBank} selisih=${analisa.selisih}`
          );
        }
      }
    }
  }

  console.log("=== UJI BADGE TERHADAP DB PRODUKSI ===");
  console.log(`Rekening            : ${rekening.length}`);
  console.log(`Hari punya saldoBank: ${hariTotal}`);
  console.log("");
  console.log(`Badge cara LAMA (per baris) : ${badgeLama}`);
  console.log(`Badge cara BARU (per hari)  : ${badgeBaru}`);
  console.log(`Turun                       : ${badgeLama - badgeBaru}`);
  console.log("");
  console.log(`Hari yang masih ditandai    : ${hariBeda} dari ${hariTotal}`);
  if (rincianHariBeda.length > 0) {
    console.log("\nRincian hari yang masih ditandai (selisih nyata):");
    for (const r of rincianHariBeda) console.log("  " + r);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
