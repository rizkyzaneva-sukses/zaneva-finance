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

// Kasus 2 — upload ulang statement yang sama (saldo bank SAMA) tetap harus dicegah.
cek(
  "2. baris yang sama persis dengan saldo bank SAMA = duplikat",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
    ],
    []
  ),
  [null, "orang"]
);

// Kasus 3 — tiga kali nominal sama, semuanya transaksi berbeda.
cek(
  "3. tiga transaksi 344.500 saldo berbeda = semua unik",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 344500, uangKeluar: 0, saldoBank: 63117891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 344500, uangKeluar: 0, saldoBank: 63117891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 344500, uangKeluar: 0, saldoBank: 63117891.82 },
    ],
    []
  ),
  [null, "orang", "orang"]
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

// Kasus 5 — screenshot tanpa saldo bank terbaca: tetap harus dicegah duplikatnya.
cek(
  "5. tanpa saldo bank sama sekali, nominal+keterangan sama = tetap duplikat",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: null },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: null },
    ],
    []
  ),
  [null, "orang"]
);

// Kasus 6 — satu terbaca saldo bank, satu tidak: tidak bisa dibuktikan berbeda,
// jadi tetap ditandai duplikat supaya tim memutuskan (bukan diam-diam lolos).
cek(
  "6. saldo bank hanya di satu baris = tetap ditandai, tim yang putuskan",
  tandaiDuplikat(
    [
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: 61450891.82 },
      { tanggalIso: "2026-10-17", keterangan: KET, uangMasuk: 175000, uangKeluar: 0, saldoBank: null },
    ],
    []
  ),
  [null, "orang"]
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
