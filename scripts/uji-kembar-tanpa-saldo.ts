/**
 * Uji regresi skenario NYATA yang dilaporkan Dea (23 Okt 2026):
 *
 * "Upload mutasi yang ada transaksi kembar → masih tetap masuk 1.
 *  Berulang di upload karena yang nominalnya double hanya terinput 1,
 *  terus yang belum terinput diupload lagi."
 *
 * Akar masalah: screenshot mobile banking BCA TIDAK menampilkan saldo berjalan,
 * jadi saldoBank = null. Perbaikan berbasis saldo bank tidak pernah aktif, dan
 * dua gerbang lain (dedupeHasilParsing + hash DB) tetap membuang baris kembar.
 *
 * Jalankan: npx tsx --tsconfig tsconfig.json scripts/uji-kembar-tanpa-saldo.ts
 */
import { tandaiDuplikat } from "../src/lib/mutasi-pola";
import { dedupeHasilParsing } from "../src/lib/openrouter";

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

const KET = "Lainnya - Pencairan RT ke - 72265540526 - Zaneva Sportwear 02";
const b = (m: number) => ({ tanggalIso: "2026-10-21", keterangan: KET, uangMasuk: m, uangKeluar: 0 });

// ───────── GERBANG 1: dedupeHasilParsing (antar baris dalam satu upload) ─────────

console.log("\n== Gerbang 1: dedupeHasilParsing (screenshot, tanpa saldo bank) ==");

// Dua transaksi kembar di SATU screenshot -> dua-duanya harus SELAMAT.
cek(
  "1. dua baris kembar dari file yang SAMA = dua transaksi sah, keduanya lolos",
  dedupeHasilParsing([
    { ...b(158500), saldoBank: null, yakin: true, sumberFile: "mutasi-21okt.png" },
    { ...b(158500), saldoBank: null, yakin: true, sumberFile: "mutasi-21okt.png" },
  ]).length,
  2
);

// Screenshot di-scroll: baris yang sama muncul di file berbeda -> memang overlap.
cek(
  "2. baris sama muncul di file BERBEDA = overlap scroll, dibuang",
  dedupeHasilParsing([
    { ...b(158500), saldoBank: null, yakin: true, sumberFile: "bagian1.png" },
    { ...b(158500), saldoBank: null, yakin: true, sumberFile: "bagian2.png" },
  ]).length,
  1
);

// Tiga kembar di satu file (kasus 344.500 muncul 3x) -> semua selamat.
cek(
  "3. tiga baris kembar di satu file = tiga transaksi sah",
  dedupeHasilParsing([
    { ...b(344500), saldoBank: null, yakin: true, sumberFile: "a.png" },
    { ...b(344500), saldoBank: null, yakin: true, sumberFile: "a.png" },
    { ...b(344500), saldoBank: null, yakin: true, sumberFile: "a.png" },
  ]).length,
  3
);

// Nominal beda: tidak tersentuh.
cek(
  "4. nominal berbeda tidak terpengaruh",
  dedupeHasilParsing([
    { ...b(1000), saldoBank: null, yakin: true, sumberFile: "a.png" },
    { ...b(2000), saldoBank: null, yakin: true, sumberFile: "a.png" },
  ]).length,
  2
);

// ───────── GERBANG 2: tandaiDuplikat terhadap DB ─────────

console.log("\n== Gerbang 2: tandaiDuplikat vs data yang sudah ada di DB ==");

// Kasus Dea: DB sudah punya 1 baris (karena upload pertama cuma masuk 1),
// sekarang upload lagi membawa 2 baris. Yang kedua HARUS lolos.
cek(
  "5. DB punya 1, upload bawa 2 (tanpa saldo) = baris ke-1 duplikat, ke-2 BARU",
  tandaiDuplikat([b(158500), b(158500)], [b(158500)]),
  ["orang", null]
);

// DB sudah punya 2, upload bawa 2 -> dua-duanya memang sudah ada, tahan semua.
cek(
  "6. DB punya 2, upload bawa 2 = dua-duanya duplikat (unggah ulang murni)",
  tandaiDuplikat([b(158500), b(158500)], [b(158500), b(158500)]),
  ["orang", "orang"]
);

// DB kosong, upload bawa 2 -> dua-duanya transaksi baru.
cek(
  "7. DB kosong, upload bawa 2 = dua-duanya masuk",
  tandaiDuplikat([b(158500), b(158500)], []),
  [null, null]
);

// DB punya 1, upload bawa 3 (kasus 344.500) -> 1 duplikat, 2 baru.
cek(
  "8. DB punya 1, upload bawa 3 = satu duplikat, dua baru",
  tandaiDuplikat([b(344500), b(344500), b(344500)], [b(344500)]),
  ["orang", null, null]
);

// Dengan saldo bank terbaca: penentu mutlak, jumlah tidak dipakai.
cek(
  "9. saldo bank berbeda = transaksi berbeda (walau DB sudah punya 1)",
  tandaiDuplikat(
    [
      { ...b(175000), saldoBank: 61450891.82 },
      { ...b(175000), saldoBank: 61275891.82 },
    ],
    [{ ...b(175000), saldoBank: 61450891.82 }]
  ),
  ["orang", null]
);

cek(
  "10. saldo bank sama persis = unggahan ulang, ditahan",
  tandaiDuplikat(
    [{ ...b(175000), saldoBank: 61450891.82 }],
    [{ ...b(175000), saldoBank: 61450891.82 }]
  ),
  ["orang"]
);

// Keterangan beda nominal sama: bukan sidik jari yang sama.
cek(
  "11. keterangan berbeda = bukan duplikat",
  tandaiDuplikat(
    [{ tanggalIso: "2026-10-21", keterangan: "QR Bayar - A", uangMasuk: 0, uangKeluar: 1000 }],
    [{ tanggalIso: "2026-10-21", keterangan: "QR Bayar - B", uangMasuk: 0, uangKeluar: 1000 }]
  ),
  [null]
);

// Arah beda (masuk vs keluar) nominal sama: bukan duplikat.
cek(
  "12. arah berbeda = bukan duplikat",
  tandaiDuplikat(
    [{ tanggalIso: "2026-10-21", keterangan: KET, uangMasuk: 0, uangKeluar: 1000 }],
    [{ tanggalIso: "2026-10-21", keterangan: KET, uangMasuk: 1000, uangKeluar: 0 }]
  ),
  [null]
);

console.log(gagal === 0 ? "\nSEMUA UJI LULUS" : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
