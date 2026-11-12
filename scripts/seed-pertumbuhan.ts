import "dotenv/config";
import ExcelJS from "exceljs";
import { imporPertumbuhanDariWorkbook } from "../src/lib/pertumbuhan-bisnis";
import { prisma } from "../src/lib/prisma";

async function main() {
  const filePath = "C:/Users/Rizky Zaneva/Downloads/CORETAN PROGRES _ Pertumbuhan Bisnis.xlsx";
  console.log("Reading file:", filePath);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  console.log("Importing into database...");
  const hasil = await imporPertumbuhanDariWorkbook(wb);
  console.log("Import result:", hasil);

  // Check records count
  const count = await prisma.pertumbuhanBisnis.count();
  console.log("Total records in PertumbuhanBisnis:", count);

  const sample = await prisma.pertumbuhanBisnis.findMany({
    include: { brand: true },
    take: 5,
    orderBy: [{ tahun: "desc" }, { bulan: "desc" }],
  });
  console.log("Sample records:", sample.map(s => ({ brand: s.brand.nama, periode: `${s.tahun}-${s.bulan}`, total: Number(s.total), pertumbuhan: Number(s.pertumbuhanNominal) })));
}

main().catch(console.error).finally(() => process.exit(0));
