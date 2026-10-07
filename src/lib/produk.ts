import ExcelJS from "exceljs";

/** Batas ukuran file Excel master/SO. 800 SKU cuma puluhan KB; ini pengaman saja. */
export const MAKS_UKURAN_EXCEL = 5 * 1024 * 1024;

/** Kunci pencocokan SKU: spasi dirapikan dan huruf kecil, supaya salah ketik spasi/kapital tidak jadi SKU baru. */
export function kunciSku(sku: string): string {
  return sku.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function rapikanSku(sku: string): string {
  return sku.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Kunci brand = huruf dan angka saja, jadi "BE SYAR'I" dan "BESYARI" sama. */
export function kunciBrand(brand: string): string {
  return brand.normalize("NFC").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Nilai sel Excel apa adanya (rumus → hasilnya, rich text → teks biasa). */
function nilaiSel(v: ExcelJS.CellValue): string | number | boolean | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") {
    if ("result" in v) return nilaiSel(v.result as ExcelJS.CellValue);
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("text" in v) return String(v.text);
    if ("error" in v) return null;
    return null;
  }
  return v;
}

export interface BarisExcel {
  /** Nomor baris di Excel (header = 1), supaya pesan error bisa menunjuk baris yang tepat. */
  nomor: number;
  sku: string;
  brand: string;
  /** Isi kolom HPP / STOK SO apa adanya — validasinya di pemanggil. */
  nilai: string | number | boolean | null;
}

export type JenisExcel = "produk" | "so";

/** Cari sheet yang header barisnya memuat kolom yang dibutuhkan; nama sheet tidak dipakai. */
export async function bacaExcel(
  buffer: Buffer | ArrayBuffer,
  jenis: JenisExcel
): Promise<{ ok: true; baris: BarisExcel[]; namaSheet: string } | { ok: false; pesan: string }> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as ArrayBuffer);
  } catch {
    return { ok: false, pesan: "File tidak bisa dibaca. Pastikan formatnya .xlsx (bukan .xls atau .csv)." };
  }

  const kolomNilai = jenis === "produk" ? /^hpp$/ : /^stok(\s*so)?$/;
  for (const ws of wb.worksheets) {
    const header = ws.getRow(1);
    const peta = new Map<string, number>();
    header.eachCell((c, kol) => {
      const t = String(nilaiSel(c.value) ?? "").trim().toLowerCase().replace(/\s+/g, " ");
      if (t) peta.set(t, kol);
    });
    const kolSku = peta.get("sku");
    const kolBrand = peta.get("brand");
    const kolNilai = [...peta.entries()].find(([t]) => kolomNilai.test(t))?.[1];
    if (!kolSku || !kolNilai) continue;

    const baris: BarisExcel[] = [];
    for (let r = 2; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const sku = String(nilaiSel(row.getCell(kolSku).value) ?? "");
      const brand = kolBrand ? String(nilaiSel(row.getCell(kolBrand).value) ?? "") : "";
      const nilai = nilaiSel(row.getCell(kolNilai).value);
      // Baris kosong total dilewati; baris yang terisi sebagian tetap dikirim agar divalidasi.
      if (!sku.trim() && !brand.trim() && (nilai === null || String(nilai).trim() === "")) continue;
      baris.push({ nomor: r, sku, brand, nilai });
    }
    return { ok: true, baris, namaSheet: ws.name };
  }

  return {
    ok: false,
    pesan:
      jenis === "produk"
        ? 'Tidak ada sheet dengan kolom "SKU" dan "HPP" di baris pertama. Pakai template dari tombol Download template.'
        : 'Tidak ada sheet dengan kolom "SKU" dan "STOK SO" di baris pertama. Pakai template dari tombol Download template.',
  };
}

/**
 * Angka dari sel. Hanya tipe angka Excel yang diterima: teks seperti "125.000"
 * ambigu (ribuan atau desimal?) dan salah baca di sini = nilai persediaan salah.
 */
export function bacaAngka(v: BarisExcel["nilai"]): { ok: true; n: number } | { ok: false; alasan: string } {
  if (v === null || (typeof v === "string" && v.trim() === "")) return { ok: false, alasan: "Kolom kosong" };
  if (typeof v !== "number") {
    return {
      ok: false,
      alasan: `"${String(v).slice(0, 30)}" bukan angka. Ketik angka biasa tanpa "Rp", titik ribuan, atau huruf (format sel Number).`,
    };
  }
  if (!Number.isFinite(v)) return { ok: false, alasan: "Bukan angka yang valid" };
  return { ok: true, n: v };
}

export interface BarisGagal {
  baris: number;
  sku: string;
  brand?: string;
  nilai: string | number | null;
  alasan: string;
}

/** Excel baris-baris yang gagal, kolomnya sama dengan template supaya bisa diperbaiki lalu diunggah ulang. */
export async function buatExcelGagal(jenis: JenisExcel, baris: BarisGagal[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(jenis === "produk" ? "DATA PRODUK" : "STOK SO");
  ws.columns =
    jenis === "produk"
      ? [
          { header: "SKU", key: "sku", width: 40 },
          { header: "Brand", key: "brand", width: 16 },
          { header: "HPP", key: "nilai", width: 14 },
          { header: "ALASAN GAGAL", key: "alasan", width: 70 },
          { header: "BARIS DI FILE ASLI", key: "baris", width: 18 },
        ]
      : [
          { header: "SKU", key: "sku", width: 40 },
          { header: "STOK SO", key: "nilai", width: 14 },
          { header: "ALASAN GAGAL", key: "alasan", width: 70 },
          { header: "BARIS DI FILE ASLI", key: "baris", width: 18 },
        ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  for (const b of baris) ws.addRow(b);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/** Template: sheet DATA PRODUK (SKU, Brand, HPP) dan STOK SO (SKU, STOK SO), diisi dari master saat ini. */
export async function buatTemplate(
  produk: { sku: string; brand: string; hpp: number }[],
  denganHpp: boolean
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  if (denganHpp) {
    const a = wb.addWorksheet("DATA PRODUK");
    a.columns = [
      { header: "SKU", key: "sku", width: 40 },
      { header: "Brand", key: "brand", width: 16 },
      { header: "HPP", key: "hpp", width: 14, style: { numFmt: "#,##0" } },
    ];
    a.getRow(1).font = { bold: true };
    a.views = [{ state: "frozen", ySplit: 1 }];
    for (const p of produk) a.addRow(p);
  }
  const b = wb.addWorksheet("STOK SO");
  b.columns = [
    { header: "SKU", key: "sku", width: 40 },
    { header: "STOK SO", key: "stok", width: 14 },
  ];
  b.getRow(1).font = { bold: true };
  b.views = [{ state: "frozen", ySplit: 1 }];
  for (const p of produk) b.addRow({ sku: p.sku, stok: 0 });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
