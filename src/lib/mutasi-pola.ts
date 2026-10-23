import { normalisasiTeks } from "@/lib/utils";

/** Kode penjualan umum. Bukan marketplace, bukan JNT VIP, bukan SAP. */
export const KODE_PENJUALAN = "400";

const BOILERPLATE = new Set([
  "TRSF", "TRANSFER", "TRANSFEREN", "EBANKING", "BANKING",
  "CR", "DB", "DR", "KR", "KREDIT", "DEBIT",
  "FTSCY", "FT", "SWITCHING", "KLIRING", "RTGS", "SKN", "LLG",
  "BIFAST", "BI", "FAST",
  "DARI", "KE", "BCA", "MANDIRI", "BRI", "BNI", "BANK", "ATM",
  "PAY", "VIA", "IBANKING", "MOBILE", "MBCA", "CLICK", "SMS", "RUPIAH",
]);

/** Nama bank di keterangan "Transfer dari ...", bukan nama orang. */
const BANK_ASAL = new Set([
  "BPD", "JATIM", "JATENG", "JABAR", "JAMBI", "BJB", "BSI", "BTN",
  "CIMB", "NIAGA", "PERMATA", "DANAMON", "MEGA", "OCBC", "PANIN", "MAYBANK",
  "UOB", "BTPN", "SEABANK", "JAGO", "SINARMAS", "MUAMALAT", "SYARIAH", "DKI",
  "NAGARI", "SUMUT", "SUMSEL", "KALBAR", "SULSEL", "BALI", "NTB",
]);

/**
 * Uang masuk yang punya kode sendiri, jadi tidak diisi otomatis 400:
 * marketplace, JNT VIP, SAP, pencairan QR, dan Mengantar (kode 410).
 */
export function pengecualianKode400(keterangan: string): boolean {
  const t = keterangan.toLowerCase();
  if (
    /shopee|lazada|tokopedia|tik\s*tok|blibli|bukalapak|midtrans/.test(t)
  ) {
    return true;
  }
  if (/\bjnt\b|\bj\s*&\s*t\b/.test(t)) return true;
  if (/\bsap\b/.test(t)) return true;
  if (/\bmengantar\b/.test(t)) return true;
  if (/qris|pencairan\s*qr|setor(?:an)?\s*qr|\bqr\b/.test(t)) return true;
  return false;
}

function tokenNama(mentah: string): string[] {
  return mentah
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter((t) => t.length >= 1 && !BOILERPLATE.has(t) && !BANK_ASAL.has(t));
}

/** Rapikan potongan nama: huruf saja, kapital, tanpa kata baku mutasi bank. */
function rapikanNama(mentah: string): string | null {
  const token = tokenNama(mentah);
  if (token.join("").length < 3) return null;
  return token.join(" ");
}

/**
 * "Transfer dari BANK MANDIRI ELAH NURLAELAH 1330..." → ELAH NURLAELAH.
 * Nomor rekening di ekor dan nama bank dibuang.
 */
function namaSetelahDari(teks: string): string | null {
  const m = teks.match(/\b(?:dari|from)\b\s+(.+)$/i);
  if (!m) return null;
  const tanpaNorek = m[1].replace(/\s+\d{5,}\s*$/, "").trim();
  const token = tokenNama(tanpaNorek);
  if (token.length === 0) return null;
  return token.join(" ");
}

/**
 * Nama lawan transaksi dari keterangan mutasi.
 * Transfer masuk BCA biasanya menaruh nama di ekor baris, kadang nempel ke nominal
 * atau ke berita transfer ("7000.00NENENG", "skyblueDANY PRIMASARI").
 */
export function namaLawan(keterangan: string): string | null {
  const teks = keterangan.replace(/\s+/g, " ").trim();
  if (!teks) return null;

  const switching = teks.match(/\bDR\s+\d{2,3}\s+([A-Z][A-Z]+(?:\s+[A-Z][A-Z]+)*)/);
  if (switching) {
    const nama = rapikanNama(switching[1]);
    if (nama) return nama;
  }

  const nominal = teks.match(/(\d{1,3}(?:\.\d{3})+,\d{2}|\d+[.,]\d{2})\s*([A-Za-z].*)$/);
  if (nominal) {
    const ekor = nominal[2].replace(/([a-z])([A-Z])/g, "$1 $2").trim();
    const caps = ekor.match(/([A-Z]{2,}(?:\s+[A-Z]{1,})*)\s*$/);
    const nama = rapikanNama(caps?.[1] ?? ekor);
    if (nama) return nama;
  }

  const dari = namaSetelahDari(teks);
  if (dari) return dari;

  const sisa = teks
    .replace(/\d{1,3}(?:\.\d{3})+,\d{2}|\d+[.,]\d{2}/g, " ")
    .replace(/[0-9]+(?:[./][A-Za-z0-9]+)*/g, " ");
  const token = tokenNama(sisa);
  if (token.length === 0) return null;
  const nama = token.slice(-4).join(" ");
  return nama.replace(/\s/g, "").length >= 3 ? nama : null;
}

/** Sidik jari yang diingat dari koreksi tim. Nama orang lebih berguna daripada kode referensi bank. */
export function kunciBelajar(keterangan: string): string | null {
  const nama = namaLawan(keterangan);
  const kunci = (nama ?? "").slice(0, 180).trim();
  return kunci.length >= 3 ? kunci : null;
}

export interface JejakMutasi {
  tanggalIso: string;
  arah: "masuk" | "keluar";
  nominal: string;
  nama: string | null;
  keterangan: string;
  /**
   * Saldo berjalan yang tercetak di mutasi bank. Ini pembeda paling kuat antara
   * "transaksi kembar yang memang dua kali terjadi" dan "baris terunggah dua kali":
   * dua transaksi berbeda punya saldo berjalan BERBEDA, sedangkan satu baris yang
   * diunggah ulang membawa saldo yang sama persis.
   */
  saldoBank: string | null;
}

export type AlasanDuplikat = "orang" | "persis";

export function nominalKunci(nilai: number): string {
  return (Math.round((nilai + Number.EPSILON) * 100) / 100).toFixed(2);
}

export function jejakMutasi(input: {
  tanggalIso: string | null;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  saldoBank?: number | null;
}): JejakMutasi | null {
  if (!input.tanggalIso) return null;
  const masuk = input.uangMasuk > 0;
  const nominal = masuk ? input.uangMasuk : input.uangKeluar;
  if (!(nominal > 0)) return null;
  return {
    tanggalIso: input.tanggalIso,
    arah: masuk ? "masuk" : "keluar",
    nominal: nominalKunci(nominal),
    nama: namaLawan(input.keterangan),
    keterangan: normalisasiTeks(input.keterangan),
    saldoBank:
      input.saldoBank === null || input.saldoBank === undefined
        ? null
        : nominalKunci(Number(input.saldoBank)),
  };
}

function samaHariNominal(a: JejakMutasi, b: JejakMutasi): boolean {
  return a.tanggalIso === b.tanggalIso && a.arah === b.arah && a.nominal === b.nominal;
}

/**
 * Duplikat terhadap mutasi yang sudah ada di DB.
 *
 * ⚠️ Dua transaksi yang nominal, tanggal, dan keterangannya sama BUKAN berarti
 * duplikat. Mutasi bank nyata sering memuat dua "Pencairan RT 175.000"
 * berturut-turut. Dulu baris seperti ini dibuang, transaksi sah hilang, lalu tim
 * mengunggah ulang berkali-kali — dan tetap hilang. Itu lingkaran setan yang
 * dilaporkan Bos (Okt 2026).
 *
 * Cara memutuskan, berurutan:
 *
 * 1. **Saldo bank ada di kedua sisi** → penentu mutlak. Saldo berbeda = transaksi
 *    berbeda. Saldo sama = unggahan ulang.
 * 2. **Saldo bank tidak terbaca** (umum di screenshot mobile banking yang tidak
 *    menampilkan saldo berjalan) → pakai HITUNG JUMLAH, bukan sekadar "sudah ada".
 *    Kalau DB punya M baris dengan sidik jari sama dan batch membawa N baris,
 *    maka min(M,N) di antaranya memang sudah tersimpan — sisanya (N−M) adalah
 *    transaksi yang belum masuk dan WAJIB disimpan.
 *
 * Hasilnya: unggah ulang statement yang sama tetap tertahan semua (N=M), tapi
 * melengkapi hari yang tadinya cuma tersimpan sebagian tetap bisa (N>M).
 */
export function tandaiDuplikat<T extends {
  tanggalIso: string | null;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  saldoBank?: number | null;
}>(baris: T[], sudahTersimpan: T[]): (AlasanDuplikat | null)[] {
  /** Sidik jari tanpa saldo bank — dasar pencocokan jumlah. */
  const sidik = (j: JejakMutasi) =>
    `${j.tanggalIso}|${j.arah}|${j.nominal}|${j.nama ?? ""}|${j.keterangan}`;

  const tersimpanJejak = sudahTersimpan
    .map(jejakMutasi)
    .filter((j): j is JejakMutasi => j !== null);

  // Berapa baris DB yang belum "terpakai" untuk tiap sidik jari.
  const sisaDiDb = new Map<string, number>();
  for (const j of tersimpanJejak) {
    const k = sidik(j);
    sisaDiDb.set(k, (sisaDiDb.get(k) ?? 0) + 1);
  }

  // Saldo bank yang sudah terpakai DI DALAM batch ini. Dua transaksi berbeda
  // mustahil meninggalkan saldo berjalan yang sama persis di dua posisi, jadi
  // saldo kembar = baris yang sama terbaca dua kali (mis. screenshot overlap
  // yang lolos, atau OCR membaca satu baris dua kali).
  const saldoTerpakai = new Set<string>();

  return baris.map((b) => {
    const jejak = jejakMutasi(b);
    if (!jejak) return null;

    const kunci = sidik(jejak);
    const sejenis = tersimpanJejak.filter((lain) => sidik(lain) === kunci);

    let alasan: AlasanDuplikat | null = null;

    if (jejak.saldoBank !== null) {
      // Penentu mutlak: saldo bank yang sama persis = baris yang sama.
      const kembar = sejenis.find((lain) => lain.saldoBank === jejak.saldoBank);
      if (kembar || saldoTerpakai.has(jejak.saldoBank)) {
        alasan = jejak.nama && kembar?.nama ? "orang" : "persis";
      }
      saldoTerpakai.add(jejak.saldoBank);
    } else {
      // Saldo bank tidak terbaca: pakai jatah. Selama masih ada baris DB yang
      // belum terpakai, baris ini dianggap sudah tersimpan. Begitu jatah habis,
      // baris berikutnya adalah transaksi BARU yang selama ini hilang.
      const sisa = sisaDiDb.get(kunci) ?? 0;
      if (sisa > 0) {
        sisaDiDb.set(kunci, sisa - 1);
        alasan = jejak.nama ? "orang" : "persis";
      }
    }

    return alasan;
  });
}

export function teksAlasanDuplikat(alasan: AlasanDuplikat): string {
  if (alasan === "orang") return "Hari, nama, dan nominal yang sama sudah ada";
  return "Transaksi yang sama persis sudah ada";
}
