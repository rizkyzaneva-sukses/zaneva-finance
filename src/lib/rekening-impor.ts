/**
 * Import massal rekening dari file Excel.
 *
 * Kolom template (baris pertama): NAMA, BANK, BRAND, NO REKENING, SALDO AWAL,
 * TANGGAL SALDO AWAL, URUTAN.
 *
 * Aturan:
 *   - NAMA  wajib, unik (kalau sudah ada → baris dianggap "ubah", bukan gagal).
 *   - BANK  wajib, salah satu: BCA / MANDIRI / BRI / BNI / PETTY CASH / LAINNYA.
 *   - BRAND opsional; kalau diisi harus brand yang sudah ada (dibuat lewat Stok & HPP).
 *   - SALDO AWAL & URUTAN opsional (default 0).
 *   - TANGGAL SALDO AWAL opsional (default hari ini WIB).
 *
 * Baris yang namanya sudah ada tapi isinya berbeda → status "ubah" (rekening
 * di-update, saldo berjalan dihitung ulang). Isi sama persis → dilewati.
 */
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { Bank } from "@/generated/prisma/enums";
import { kunciBrand } from "@/lib/produk";
import { hariIniWib } from "@/lib/alokasi";

export const MAKS_UKURAN_EXCEL_REKENING = 5 * 1024 * 1024;

// ── Pemetaan teks bank → enum ───────────────────────────────
const PETA_BANK: Record<string, Bank> = {
  BCA: Bank.BCA,
  MANDIRI: Bank.MANDIRI,
  BRI: Bank.BRI,
  BNI: Bank.BNI,
  "PETTY CASH": Bank.PETTY_CASH,
  PETTYCASH: Bank.PETTY_CASH,
  PETTY_CASH: Bank.PETTY_CASH,
  KAS: Bank.PETTY_CASH,
  "KAS TUNAI": Bank.PETTY_CASH,
  TUNAI: Bank.PETTY_CASH,
  LAINNYA: Bank.LAINNYA,
  LAIN: Bank.LAINNYA,
};

function parseBank(v: ExcelJS.CellValue): Bank | null {
  const t = teks(v).toUpperCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ").trim();
  return PETA_BANK[t] ?? null;
}

// ── Konversi nilai sel ──────────────────────────────────────
function teks(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return fmtTanggal(v);
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text.trim();
    if ("richText" in v && Array.isArray(v.richText)) {
      return (v.richText as { text: string }[]).map((t) => t.text).join("").trim();
    }
    if ("result" in v) return teks(v.result as ExcelJS.CellValue);
    return "";
  }
  return String(v).trim();
}

function fmtTanggal(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Angka rupiah: terima 5000000, "5.000.000", "Rp 5.000.000,50". */
function angka(v: ExcelJS.CellValue): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = teks(v).replace(/rp/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(/,(\d{2})$/, ".$1");
  if (s === "" || s === "-") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Tanggal: terima Date (sel tanggal Excel), yyyy-mm-dd, atau dd/mm/yyyy. */
function tanggal(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date) return fmtTanggal(v);
  const s = teks(v);
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

// ── Tipe hasil ──────────────────────────────────────────────
export interface PerubahanRekening {
  status: "baru" | "ubah";
  baris: number;
  nama: string;
  bank: Bank;
  brand: string | null;
  brandKunci: string | null;
  nomorRekening: string | null;
  saldoAwal: number;
  tanggalSaldoAwal: string;
  urutan: number;
  /** Field yang berbeda dari data tersimpan (hanya untuk status "ubah"). */
  diubah: string[];
}

export interface GagalRekening {
  baris: number;
  nama: string;
  alasan: string;
}

export interface HasilAnalisaRekening {
  namaSheet: string;
  jumlahBaris: number;
  baru: PerubahanRekening[];
  ubah: PerubahanRekening[];
  gagal: GagalRekening[];
  jumlahSama: number;
}

export type AnalisaRekening =
  | { ok: true; hasil: HasilAnalisaRekening }
  | { ok: false; pesan: string };

const HEADER_NAMA = ["NAMA", "NAMA REKENING", "REKENING"];
const HEADER_BANK = ["BANK", "JENIS", "TIPE"];

/** Cari sheet yang header barisnya memuat kolom NAMA + BANK; nama sheet bebas. */
export async function analisaRekening(buffer: ArrayBuffer): Promise<AnalisaRekening> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  let ws: ExcelJS.Worksheet | undefined;
  let kolom: Record<string, number> = {};
  for (const s of wb.worksheets) {
    const row = s.getRow(1);
    const nums: string[] = [];
    const map: Record<string, number> = {};
    row.eachCell((cell, col) => {
      nums[col] = teks(cell.value).toUpperCase();
      map[nums[col]] = col;
    });
    const cNama = HEADER_NAMA.map((h) => map[h]).find((x) => x);
    const cBank = HEADER_BANK.map((h) => map[h]).find((x) => x);
    if (cNama && cBank) {
      ws = s;
      kolom = {
        nama: cNama,
        bank: cBank,
        brand: map["BRAND"] ?? 0,
        nomor: map["NO REKENING"] ?? map["NOMOR REKENING"] ?? map["NOMOR"] ?? 0,
        saldo: map["SALDO AWAL"] ?? map["SALDO"] ?? 0,
        tanggal: map["TANGGAL SALDO AWAL"] ?? map["TANGGAL"] ?? 0,
        urutan: map["URUTAN"] ?? 0,
      };
      break;
    }
  }
  if (!ws) {
    return {
      ok: false,
      pesan: 'Tidak ada sheet dengan kolom "NAMA" dan "BANK" di baris pertama. Pakai template dari tombol Download template.',
    };
  }

  const [rekeningLama, brands] = await Promise.all([
    prisma.rekening.findMany({ select: { id: true, nama: true, bank: true, nomorRekening: true, saldoAwal: true, tanggalSaldoAwal: true, urutan: true, brandId: true } }),
    prisma.brand.findMany({ select: { id: true, nama: true, kunci: true } }),
  ]);
  const lamaPerNama = new Map(rekeningLama.map((r) => [r.nama.toLowerCase(), r]));
  const brandKunciSet = new Map(brands.map((b) => [kunciBrand(b.nama), b]));

  const baru: PerubahanRekening[] = [];
  const ubah: PerubahanRekening[] = [];
  const gagal: GagalRekening[] = [];
  let jumlahSama = 0;
  let jumlahBaris = 0;
  const namaTerpakai = new Set<string>();

  const ambil = (row: ExcelJS.Row, col: number) => (col > 0 ? row.getCell(col).value : null);

  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const nama = teks(ambil(row, kolom.nama));
    const bankRaw = teks(ambil(row, kolom.bank));
    if (!nama && !bankRaw) return; // baris kosong
    jumlahBaris++;
    const nomorBaris = idx;

    if (!nama) {
      gagal.push({ baris: nomorBaris, nama: "", alasan: "NAMA kosong" });
      return;
    }
    const kunci = nama.toLowerCase();
    if (namaTerpakai.has(kunci)) {
      gagal.push({ baris: nomorBaris, nama, alasan: "Nama duplikat di dalam file" });
      return;
    }

    const bank = parseBank(bankRaw);
    if (!bank) {
      gagal.push({ baris: nomorBaris, nama, alasan: `BANK "${bankRaw}" tidak dikenal (pakai BCA/MANDIRI/BRI/BNI/PETTY CASH/LAINNYA)` });
      return;
    }

    // Brand opsional
    let brand: string | null = null;
    let brandKunci: string | null = null;
    const brandRaw = teks(ambil(row, kolom.brand));
    if (brandRaw) {
      const kk = kunciBrand(brandRaw);
      const hit = brandKunciSet.get(kk);
      if (!hit) {
        gagal.push({ baris: nomorBaris, nama, alasan: `Brand "${brandRaw}" belum ada (buat dulu lewat Stok & HPP)` });
        return;
      }
      brand = hit.nama;
      brandKunci = hit.kunci;
    }

    const nomorRekening = teks(ambil(row, kolom.nomor)) || null;
    const saldoAwal = angka(ambil(row, kolom.saldo)) ?? 0;
    const tgl = tanggal(ambil(row, kolom.tanggal)) ?? hariIniWib();
    const urutan = Math.trunc(angka(ambil(row, kolom.urutan)) ?? 0);

    const lama = lamaPerNama.get(kunci);
    if (!lama) {
      namaTerpakai.add(kunci);
      baru.push({ status: "baru", baris: nomorBaris, nama, bank, brand, brandKunci, nomorRekening, saldoAwal, tanggalSaldoAwal: tgl, urutan, diubah: [] });
      return;
    }

    // Bandingkan dengan data tersimpan
    const diubah: string[] = [];
    if (lama.bank !== bank) diubah.push("bank");
    if ((lama.nomorRekening ?? "") !== (nomorRekening ?? "")) diubah.push("nomorRekening");
    if (Number(lama.saldoAwal) !== saldoAwal) diubah.push("saldoAwal");
    if (fmtTanggal(lama.tanggalSaldoAwal) !== tgl) diubah.push("tanggalSaldoAwal");
    if (lama.urutan !== urutan) diubah.push("urutan");
    const brandLama = lama.brandId ? brands.find((b) => b.id === lama.brandId) : null;
    if ((brandLama?.kunci ?? null) !== brandKunci) diubah.push("brand");

    if (diubah.length === 0) {
      jumlahSama++;
      namaTerpakai.add(kunci);
      return;
    }
    namaTerpakai.add(kunci);
    ubah.push({ status: "ubah", baris: nomorBaris, nama, bank, brand, brandKunci, nomorRekening, saldoAwal, tanggalSaldoAwal: tgl, urutan, diubah });
  });

  return { ok: true, hasil: { namaSheet: ws.name, jumlahBaris, baru, ubah, gagal, jumlahSama } };
}

/** Template: header + 2 baris contoh. */
export async function buatTemplateRekening(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("REKENING");
  ws.columns = [
    { header: "NAMA", key: "nama", width: 32 },
    { header: "BANK", key: "bank", width: 14 },
    { header: "BRAND", key: "brand", width: 20 },
    { header: "NO REKENING", key: "nomor", width: 22 },
    { header: "SALDO AWAL", key: "saldo", width: 16, style: { numFmt: "#,##0" } },
    { header: "TANGGAL SALDO AWAL", key: "tanggal", width: 20 },
    { header: "URUTAN", key: "urutan", width: 10 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.addRow({ nama: "BCA CV Utama", bank: "BCA", brand: "", nomor: "1234567890", saldo: 5000000, tanggal: hariIniWib(), urutan: 10 });
  ws.addRow({ nama: "Kas Gudang", bank: "PETTY CASH", brand: "", nomor: "", saldo: 1000000, tanggal: hariIniWib(), urutan: 20 });
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Excel berisi baris gagal, kolomnya sama + alasan, supaya bisa diperbaiki lalu diunggah ulang. */
export async function buatExcelGagalRekening(baris: GagalRekening[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("REKENING GAGAL");
  ws.columns = [
    { header: "NAMA", key: "nama", width: 32 },
    { header: "ALASAN GAGAL", key: "alasan", width: 70 },
    { header: "BARIS DI FILE ASLI", key: "baris", width: 18 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const b of baris) ws.addRow(b);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
