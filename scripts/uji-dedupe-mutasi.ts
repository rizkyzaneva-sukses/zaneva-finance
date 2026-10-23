/**
 * Uji regresi anti-duplikat memakai kasus NYATA yang dilaporkan Bos
 * (mutasi Mandiri 17 Okt 2026, rekening 1320015120943).
 *
 * Kasus inti: "Lainnya - Pencairan RT ke - 72265540526 - Zaneva Sportwear 02"
 * nominal 175.000 muncul DUA KALI di hari yang sama, dengan saldo berjalan
 * berbeda (61.450.891,82 dan 61.275.891,82). Itu dua transaksi sah dan WAJIB
 * bisa masuk dua-duanya tanpa diklik "Jadikan unik".
 *
 * Jalankan: npx tsx scripts/uji-dedupe-mutasi.ts
 */
import { tandaiDuplikat, teksAlasanDuplikat } from "../src/lib/mutasi-pola";

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

// Kasus 1 — dua transaksi kembar yang SAH (saldo bank berbeda).
// Ini bug yang dilaporkan: dulu baris kedua ditandai duplikat lalu tidak masuk.
cek(
  "1. dua transaksi 175.000 di hari sama, saldo bank BERBEDA = bukan duplikat",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61275891.82 },
    ],
    []
  ),
  [null, null]
);

// Kasus 2 — baris yang sama persis dengan saldo bank SAMA = duplikat.
// (Alasan "persis" bukan "orang" karena keterangan ini tidak memuat nama lawan.)
cek(
  "2. baris yang sama persis dengan saldo bank SAMA = duplikat",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
    ],
    []
  ),
  [null, "persis"]
);

// Kasus 3 — tiga transaksi 344.500 di hari yang sama, masing-masing dengan
// saldo berjalan BERBEDA (begitulah mutasi asli: tiap transaksi menggeser saldo).
// Ketiganya SAH dan harus masuk. Ini bug inti yang dilaporkan Dea.
cek(
  "3. tiga transaksi 344.500 saldo berbeda = ketiganya masuk",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 344500, uangKeluar: 0, saldoBank: 63117891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 344500, uangKeluar: 0, saldoBank: 63462391.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 344500, uangKeluar: 0, saldoBank: 63806891.82 },
    ],
    []
  ),
  [null, null, null]
);

// Kasus 4 — terhadap data yang SUDAH tersimpan di DB.
cek(
  "4. baris baru beda saldo bank dari yang tersimpan = bukan duplikat",
  tandaiDuplikat(
    [{ tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61275891.82 }],
    [{ tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 }]
  ),
  [null]
);

// Kasus 5 — screenshot tanpa saldo bank terbaca: baris kedua dalam satu batch
// adalah transaksi sah kedua, bukan duplikat. (Revisi 23 Okt — koreksi Dea:
// screenshot BCA tidak menampilkan saldo berjalan, dan dulu baris kedua hilang.)
cek(
  "5. tanpa saldo bank, dua baris kembar di satu batch = keduanya baru",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: null },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: null },
    ],
    []
  ),
  [null, null]
);

// Kasus 6 — satu terbaca saldo bank, satu tidak: saldo yang sama membuktikan
// baris kedua sudah ada di DB, jadi tetap ditahan.
cek(
  "6. saldo bank sama dengan yang tersimpan = ditahan",
  tandaiDuplikat(
    [{ tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 }],
    [{ tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 }]
  ),
  ["orang"]
);

// Kasus 7 — nominal beda: jelas bukan duplikat.
cek(
  "7. nominal berbeda = bukan duplikat",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 176000, uangKeluar: 0, saldoBank: 61275891.82 },
    ],
    []
  ),
  [null, null]
);

// Kasus 8 — transaksi yang sama tapi beda hari: bukan duplikat.
cek(
  "8. hari berbeda = bukan duplikat",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-16", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 59097803.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
    ],
    []
  ),
  [null, null]
);

console.log(`\nAlasan duplikat yang dipakai di UI: "${teksAlasanDuplikat("orang")}"`);
console.log(gagal === 0 ? "\nSEMUA UJI LULUS" : `\n${gagal} UJI GAGAL`);
process.exit(gagal === 0 ? 0 : 1);
