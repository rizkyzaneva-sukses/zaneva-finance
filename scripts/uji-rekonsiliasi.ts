/**
 * Uji rekonsiliasi terhadap data produksi asli (758 baris, 14 rekening).
 *
 * Dijalankan dengan `npx tsx scripts/uji-rekonsiliasi.ts`.
 * Membuktikan: badge "beda dgn bank" turun dari 196 → hanya hari yang nyata beda.
 */
import { readFileSync } from "node:fs";
import { Prisma } from "../src/generated/prisma/client";
import { analisaHari, tentukanBadge } from "../src/lib/rekonsiliasi";

type Baris = {
  nomorRekening: string;
  tanggal: string;
  urutanInput: string;
  keterangan: string;
  uangMasuk: string;
  uangKeluar: string;
  saldo: string;
  saldoBank: string;
  saldoAwal: string;
};

const isi = readFileSync("D:/tmp/analisa/trx.csv", "utf8").trim().split(/\r?\n/);
const kepala = isi[0].split(",");
const idx = (nama: string) => kepala.indexOf(nama);

const baris: Baris[] = isi.slice(1).map((line) => {
  const k = line.split(",");
  return {
    nomorRekening: k[idx("nomorRekening")],
    tanggal: k[idx("tanggal")],
    urutanInput: k[idx("urutanInput")],
    keterangan: k[idx("keterangan")],
    uangMasuk: k[idx("uangMasuk")],
    uangKeluar: k[idx("uangKeluar")],
    saldo: k[idx("saldo")],
    saldoBank: k[idx("saldoBank")],
    saldoAwal: k[idx("saldoAwal")],
  };
});

const TOL = new Prisma.Decimal("1");
const rekeningList = [...new Set(baris.map((b) => b.nomorRekening))];

let badgeLama = 0;
let badgeBaru = 0;
let hariBeda = 0;
let hariTotal = 0;

for (const rek of rekeningList) {
  const milik = baris
    .filter((b) => b.nomorRekening === rek)
    .map((b, i) => ({
      id: `${rek}-${i}`,
      tanggal: new Date(`${b.tanggal}T00:00:00.000Z`),
      urutanInput: Number(b.urutanInput),
      uangMasuk: new Prisma.Decimal(b.uangMasuk || "0"),
      uangKeluar: new Prisma.Decimal(b.uangKeluar || "0"),
      saldo: new Prisma.Decimal(b.saldo || "0"),
      saldoBank: b.saldoBank ? new Prisma.Decimal(b.saldoBank) : null,
      saldoAwal: new Prisma.Decimal(b.saldoAwal),
    }));

  const perTanggal = new Map<string, typeof milik>();
  for (const t of milik) {
    const kunci = t.tanggal.toISOString().slice(0, 10);
    const d = perTanggal.get(kunci);
    if (d) d.push(t);
    else perTanggal.set(kunci, [t]);
  }

  let berjalan = milik[0].saldoAwal;
  for (const kunci of [...perTanggal.keys()].sort()) {
    const daftar = [...perTanggal.get(kunci)!].sort((a, b) => a.urutanInput - b.urutanInput);
    const sebelum = berjalan;
    berjalan = daftar.reduce(
      (a, t) => a.plus(t.uangMasuk).minus(t.uangKeluar),
      sebelum
    );

    // Cara LAMA: bandingkan saldo tiap baris vs saldoBank-nya.
    const lama = daftar.filter(
      (t) => t.saldoBank !== null && t.saldo.minus(t.saldoBank).abs().greaterThanOrEqualTo(TOL)
    );
    badgeLama += lama.length;

    // Cara BARU: rekonsiliasi per hari.
    const analisa = analisaHari(daftar, sebelum);
    const baru = tentukanBadge(daftar, analisa, TOL);
    badgeBaru += baru.size;

    if (analisa.adaSaldoBank) {
      hariTotal += 1;
      if (baru.size > 0) hariBeda += 1;
    }
  }
}

console.log("=== UJI REKONSILIASI DATA PRODUKSI ===");
console.log(`Baris        : ${baris.length}`);
console.log(`Rekening     : ${rekeningList.length}`);
console.log(`Hari bersaldo: ${hariTotal}`);
console.log("");
console.log(`Badge cara LAMA (per baris) : ${badgeLama}`);
console.log(`Badge cara BARU (per hari)  : ${badgeBaru}`);
console.log(`Turun                       : ${badgeLama - badgeBaru}`);
console.log("");
console.log(`Hari yang masih ditandai    : ${hariBeda} dari ${hariTotal}`);
