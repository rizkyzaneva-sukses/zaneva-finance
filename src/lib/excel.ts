import ExcelJS from "exceljs";
import type { BniTransaction, MandiriTransaction } from "@/lib/types";

export async function buildBniWorkbook(rows: BniTransaction[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mutasi BNI");

  ws.columns = [
    { header: "TANGGAL", key: "tanggal", width: 20 },
    { header: "URAIAN TRANSAKSI", key: "uraian", width: 38 },
    { header: "", key: "kosong", width: 4 },
    { header: "TYPE", key: "type", width: 10 },
    { header: "JUMLAH PEMBAYARAN", key: "jumlah", width: 20 },
    { header: "SALDO", key: "saldo", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  rows.forEach((r) => {
    const row = ws.addRow({
      tanggal: r.tanggal,
      uraian: r.uraian,
      kosong: "",
      type: r.type,
      jumlah: r.jumlah,
      saldo: r.saldo,
    });
    if (!r.yakin) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      });
    }
  });

  ws.getColumn("jumlah").numFmt = "#,##0.00";
  ws.getColumn("saldo").numFmt = "#,##0.00";

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function buildMandiriWorkbook(rows: MandiriTransaction[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Mutasi Mandiri");

  ws.columns = [
    { header: "TANGGAL", key: "tanggal", width: 22 },
    { header: "TRANSAKSI", key: "transaksi", width: 50 },
    { header: "DEBIT", key: "debit", width: 18 },
    { header: "KREDIT", key: "kredit", width: 18 },
    { header: "SALDO", key: "saldo", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  rows.forEach((r) => {
    const row = ws.addRow({ ...r, saldo: r.saldo ?? "" });
    if (r.yakin === false) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      });
    }
  });

  ws.getColumn("debit").numFmt = "#,##0.00";
  ws.getColumn("kredit").numFmt = "#,##0.00";
  ws.getColumn("saldo").numFmt = "#,##0.00";

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
