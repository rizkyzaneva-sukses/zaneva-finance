/**
 * Uji regresi `rapikanUrutanIkutSaldoBank` memakai data NYATA rekening
 * 1320015120943 (mutasi Mandiri Okt 2026) yang dilaporkan Bos.
 *
 * Kenapa data nyata: data ini punya semua kasus sulit sekaligus — transaksi
 * kembar sah, hari yang diunggah dua kali, hari tanpa saldo bank, dan satu
 * hari yang rantainya bolong. Algoritma harus merapikan yang bisa dirapikan
 * dan TIDAK merusak yang tidak bisa dibuktikan.
 *
 * Jalankan: npx tsx --tsconfig tsconfig.json scripts/uji-urutan-saldo.ts
 */
import { readFileSync } from "node:fs";

// Logika rantai disalin dari src/lib/rekap.ts (rapikanUrutanIkutSaldoBank)
// karena fungsi aslinya butuh Prisma. Dijaga tetap 1:1 — kalau kode asli
// berubah, uji ini harus ikut diubah.
type Baris = {
  id: string;
  u: number;
  m: number;
  k: number;
  sb: number | null;
};

function rapikan(baris: Baris[]): Baris[] {
  const perTanggal = new Map<string, Baris[]>();
  for (const t of baris) {
    const d = perTanggal.get(t.id.slice(0, 10));
    // id di data uji sudah diberi awalan tanggal oleh pemanggil
    if (d) d.push(t);
    else perTanggal.set(t.id.slice(0, 10), [t]);
  }
  void perTanggal;
  return baris;
}
void rapikan;

// ---- versi uji: mengikuti algoritma produksi persis ----
const f2 = (n: number) => n.toFixed(2);

function urutkan(daftar: { tanggal: string; urutanInput: number; uangMasuk: number; uangKeluar: number; saldoBank: number | null }[]) {
  const perTanggal = new Map<string, typeof daftar>();
  for (const t of daftar) {
    const isi = perTanggal.get(t.tanggal);
    if (isi) isi.push(t);
    else perTanggal.set(t.tanggal, [t]);
  }

  const hasil: typeof daftar = [];
  for (const kunci of [...perTanggal.keys()].sort()) {
    const semua = perTanggal.get(kunci)!;
    const bersaldo = semua.filter((t) => t.saldoBank !== null);
    const tanpaSaldo = semua.filter((t) => t.saldoBank === null);

    const simpul = new Map<string, typeof bersaldo>();
    for (const t of bersaldo) {
      const s = f2(t.saldoBank!);
      const isi = simpul.get(s);
      if (isi) isi.push(t);
      else simpul.set(s, [t]);
    }
    if (simpul.size < 2) {
      hasil.push(...semua);
      continue;
    }
    const sebelumnya = new Map<string, string>();
    for (const [s, isi] of simpul) {
      sebelumnya.set(s, f2(isi[0].saldoBank! - isi[0].uangMasuk + isi[0].uangKeluar));
    }
    const titikAwal = [...sebelumnya.entries()].filter(([, prev]) => !simpul.has(prev));
    if (titikAwal.length !== 1) {
      hasil.push(...semua);
      continue;
    }
    const berangkat = new Map<string, string[]>();
    for (const [s, prev] of sebelumnya) {
      const d = berangkat.get(prev);
      if (d) d.push(s);
      else berangkat.set(prev, [s]);
    }
    const urut: string[] = [];
    const dipakai = new Set<string>();
    let sekarang: string | undefined = titikAwal[0][0];
    let bercabang = false;
    while (sekarang && !dipakai.has(sekarang)) {
      urut.push(sekarang);
      dipakai.add(sekarang);
      const berikut: string[] = (berangkat.get(sekarang) ?? []).filter((s) => !dipakai.has(s));
      if (berikut.length > 1) {
        bercabang = true;
        break;
      }
      sekarang = berikut[0];
    }
    if (bercabang || urut.length !== simpul.size) {
      hasil.push(...semua);
      continue;
    }
    for (const s of urut) hasil.push(...simpul.get(s)!);
    hasil.push(...[...tanpaSaldo].sort((a, b) => a.urutanInput - b.urutanInput));
  }
  return hasil;
}

// ---------- data nyata ----------
const CSV = process.argv[2];
if (!CSV) {
  console.error("pakai: npx tsx scripts/uji-urutan-saldo.ts <file.csv>");
  process.exit(2);
}

const teks = readFileSync(CSV, "utf8").replace(/\r/g, "");
const lines = teks.trim().split("\n");
const head = lines[0].split(",");
const idx = (n: string) => head.indexOf(n);
const iTg = idx("tg"), iU = idx("u"), iM = idx("m"), iK = idx("k"), iSb = idx("sb"), iAwal = idx("awal");

const data = lines.slice(1).map((l) => {
  const c = l.split(",");
  return {
    tanggal: c[iTg],
    urutanInput: Number(c[iU]),
    uangMasuk: Number(c[iM]),
    uangKeluar: Number(c[iK]),
    saldoBank: c[iSb] === "" ? null : Number(c[iSb]),
  };
});
const awal = Number(lines[1].split(",")[iAwal]);

function hitungMeleset(urut: typeof data) {
  let jalan = awal;
  let n = 0;
  for (const t of urut) {
    jalan = jalan + t.uangMasuk - t.uangKeluar;
    if (t.saldoBank !== null && f2(jalan) !== f2(t.saldoBank)) n++;
    if (t.saldoBank !== null) jalan = t.saldoBank;
  }
  return n;
}

/**
 * Meleset DI DALAM satu hari saja. Baris pertama hari sengaja dilewati:
 * saldo awalnya diwarisi dari hari sebelumnya, dan kalau hari sebelumnya
 * rantainya bolong (data OCR hilang), angka warisan itu memang tidak bisa
 * dibuat cocok oleh pengurutan mana pun. Yang bisa diperbaiki — dan yang
 * diuji di sini — adalah konsistensi rantai di dalam hari itu sendiri.
 */
function hitungMelesetDalamHari(urut: typeof data) {
  const perHari = new Map<string, typeof data>();
  for (const t of urut) {
    const isi = perHari.get(t.tanggal);
    if (isi) isi.push(t);
    else perHari.set(t.tanggal, [t]);
  }
  let n = 0;
  for (const daftar of perHari.values()) {
    let jalan: number | null = null;
    for (const t of daftar) {
      if (t.saldoBank === null) continue;
      if (jalan === null) {
        jalan = t.saldoBank;
        continue;
      }
      const hitung = jalan + t.uangMasuk - t.uangKeluar;
      if (f2(hitung) !== f2(t.saldoBank)) n++;
      jalan = t.saldoBank;
    }
  }
  return n;
}

let gagal = 0;
function cek(nama: string, aktual: unknown, harapan: unknown) {
  const ok = JSON.stringify(aktual) === JSON.stringify(harapan);
  console.log(`${ok ? "  OK  " : " GAGAL"}  ${nama}`);
  if (!ok) {
    console.log(`         harapan: ${JSON.stringify(harapan)}`);
    console.log(`         aktual : ${JSON.stringify(aktual)}`);
    gagal++;
  }
}

const asli = [...data].sort((a, b) => (a.tanggal + String(a.urutanInput).padStart(5, "0")).localeCompare(
  b.tanggal + String(b.urutanInput).padStart(5, "0")
));
const rapikanHasil = urutkan(data);

const melesetAsli = hitungMeleset(asli);
const melesetBaru = hitungMeleset(rapikanHasil);

console.log(`\nData: ${data.length} baris, saldo awal ${awal}`);
console.log(`  sebelum perbaikan : ${melesetAsli} baris "beda dgn bank"`);
console.log(`  sesudah perbaikan : ${melesetBaru} baris "beda dgn bank"`);
console.log("");

cek("total masuk tidak berubah", rapikanHasil.reduce((s, t) => s + t.uangMasuk, 0), asli.reduce((s, t) => s + t.uangMasuk, 0));
cek("total keluar tidak berubah", rapikanHasil.reduce((s, t) => s + t.uangKeluar, 0), asli.reduce((s, t) => s + t.uangKeluar, 0));
cek("jumlah baris tidak berubah", rapikanHasil.length, data.length);
cek("baris peringatan berkurang nyata (>40 baris)", melesetAsli - melesetBaru >= 40, true);
cek("tidak ada baris hilang/duplikat", new Set(rapikanHasil.map((t) => `${t.tanggal}|${t.urutanInput}`)).size, data.length);

// tanggal 18 Okt sebelumnya DIRAPIKAN penuh — pastikan tetap begitu
const t18Asli = asli.filter((t) => t.tanggal === "2026-10-18");
const t18Baru = rapikanHasil.filter((t) => t.tanggal === "2026-10-18");
console.log(
  `\n18 Okt meleset DI DALAM hari: ${hitungMelesetDalamHari(t18Asli)} -> ${hitungMelesetDalamHari(t18Baru)}`
);
cek("18 Okt rantai dalam harinya jadi rapi penuh", hitungMelesetDalamHari(t18Baru), 0);

// hari yang rantainya bolong HARUS dibiarkan apa adanya (bukan dirusak)
const t17Asli = asli.filter((t) => t.tanggal === "2026-10-17").map((t) => t.urutanInput);
const t17Baru = rapikanHasil.filter((t) => t.tanggal === "2026-10-17").map((t) => t.urutanInput);
cek("17 Okt (rantai bolong) urutannya dibiarkan, tidak dirusak", t17Baru, t17Asli);

console.log(gagal === 0 ? "\nSEMUA UJI LULUS" : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
