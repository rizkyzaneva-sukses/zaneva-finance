import ExcelJS from "exceljs";
import { formatTanggal } from "@/lib/utils";

export interface BarisRekapExcel {
  tanggal: Date | string;
  kode: string;
  keterangan: string;
  uangMasuk: number;
  uangKeluar: number;
  saldo: number;
  catatan: string;
  /** Ditandai kalau AI ragu membacanya — diberi latar merah muda di file */
  yakin?: boolean;
}

export interface OpsiRekap {
  namaRekening: string;
  /** Baris saldo awal (kode 0000) yang ditaruh paling atas, seperti contoh rekap tim */
  saldoAwal?: { tanggal: Date | string; nominal: number };
}

const ABU = "FFE5E7EB";
const MERAH_MUDA = "FFFEE2E2";

/**
 * Excel menolak nama sheet yang mengandung * ? : \ / [ ] , lebih dari 31 karakter,
 * atau diawali/diakhiri apostrof. Nama rekening diisi bebas oleh user, jadi harus
 * dibersihkan — kalau tidak, export gagal dengan error 500 yang membingungkan.
 */
export function namaSheetAman(nama: string): string {
  const bersih = nama
    .replace(/[*?:\\/[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^'+|'+$/g, "")
    .slice(0, 31)
    .trim();
  return bersih || "Rekap";
}

export async function buildRekapWorkbook(
  rows: BarisRekapExcel[],
  opsi: OpsiRekap
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(namaSheetAman(opsi.namaRekening));

  ws.columns = [
    { header: "No.", key: "no", width: 6 },
    { header: "Tanggal", key: "tanggal", width: 18 },
    { header: "Kode", key: "kode", width: 10 },
    { header: "Keterangan", key: "keterangan", width: 52 },
    { header: "Uang masuk", key: "uangMasuk", width: 18 },
    { header: "Uang keluar", key: "uangKeluar", width: 18 },
    { header: "Saldo", key: "saldo", width: 20 },
    { header: "Catatan", key: "catatan", width: 30 },
  ];

  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
  });

  let no = 0;

  if (opsi.saldoAwal) {
    no += 1;
    ws.addRow({
      no,
      tanggal: formatTanggal(opsi.saldoAwal.tanggal),
      kode: "0000",
      keterangan: "Saldo",
      uangMasuk: opsi.saldoAwal.nominal,
      uangKeluar: null,
      saldo: opsi.saldoAwal.nominal,
      catatan: "",
    });
  }

  for (const r of rows) {
    no += 1;
    const row = ws.addRow({
      no,
      tanggal: formatTanggal(r.tanggal),
      kode: r.kode,
      keterangan: r.keterangan,
      // Sel dikosongkan (bukan 0) supaya kolom yang tidak terpakai tidak ramai
      uangMasuk: r.uangMasuk || null,
      uangKeluar: r.uangKeluar || null,
      saldo: r.saldo,
      catatan: r.catatan,
    });
    if (r.yakin === false) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MERAH_MUDA } };
      });
    }
  }

  for (const key of ["uangMasuk", "uangKeluar", "saldo"]) {
    ws.getColumn(key).numFmt = "#,##0.00";
    ws.getColumn(key).alignment = { horizontal: "right" };
  }
  ws.getColumn("no").alignment = { horizontal: "center" };
  ws.views = [{ state: "frozen", ySplit: 1 }];

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
