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
  };
}

function samaHariNominal(a: JejakMutasi, b: JejakMutasi): boolean {
  return a.tanggalIso === b.tanggalIso && a.arah === b.arah && a.nominal === b.nominal;
}

/**
 * Duplikat terhadap mutasi yang sudah ada (DB) dan terhadap baris sebelumnya di batch yang sama.
 * Prioritas: hari + nama + nominal. Kalau nama tidak terbaca, baru keterangan yang persis sama.
 */
export function tandaiDuplikat<T extends {
  tanggalIso: string | null;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
}>(baris: T[], sudahTersimpan: T[]): (AlasanDuplikat | null)[] {
  const terlihat: JejakMutasi[] = [];
  for (const lama of sudahTersimpan) {
    const jejak = jejakMutasi(lama);
    if (jejak) terlihat.push(jejak);
  }

  return baris.map((b) => {
    const jejak = jejakMutasi(b);
    if (!jejak) return null;

    let alasan: AlasanDuplikat | null = null;
    if (jejak.nama) {
      const orang = terlihat.some((lain) => samaHariNominal(jejak, lain) && lain.nama === jejak.nama);
      if (orang) alasan = "orang";
    }
    if (!alasan) {
      const persis = terlihat.some(
        (lain) => samaHariNominal(jejak, lain) && lain.keterangan === jejak.keterangan
      );
      if (persis) alasan = "persis";
    }
    terlihat.push(jejak);
    return alasan;
  });
}

export function teksAlasanDuplikat(alasan: AlasanDuplikat): string {
  if (alasan === "orang") return "Hari, nama, dan nominal yang sama sudah ada";
  return "Transaksi yang sama persis sudah ada";
}
