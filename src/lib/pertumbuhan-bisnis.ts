import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { kunciBrand } from "@/lib/produk";
import ExcelJS from "exceljs";

export interface DetailBankItem {
  nama: string;
  nominal: number;
}

export interface InputPertumbuhan {
  brandId: string;
  tahun: number;
  bulan: number;
  detailBank?: DetailBankItem[];
  kasBesar?: number;
  kasKecil?: number;
  piutangVendor?: number;
  utangVendor?: number;
  outstandingShopeeLazada?: number;
  outstandingSap?: number;
  outstandingJnt?: number;
  outstandingTiktok?: number;
  outstandingLainnya?: number;
  inventory?: number;
  hutangLainnya?: number;
  keteranganHutang?: string;
  catatan?: string;
}

export function hitungSubtotal(input: Partial<InputPertumbuhan>) {
  const detailBank = input.detailBank || [];
  const cashOnBank = detailBank.reduce((acc, curr) => acc + (Number(curr.nominal) || 0), 0);
  const kasBesar = Number(input.kasBesar) || 0;
  const kasKecil = Number(input.kasKecil) || 0;
  const cashOnHand = kasBesar + kasKecil;

  const piutangVendor = Number(input.piutangVendor) || 0;
  const utangVendor = Number(input.utangVendor) || 0;

  const outstandingShopeeLazada = Number(input.outstandingShopeeLazada) || 0;
  const outstandingSap = Number(input.outstandingSap) || 0;
  const outstandingJnt = Number(input.outstandingJnt) || 0;
  const outstandingTiktok = Number(input.outstandingTiktok) || 0;
  const outstandingLainnya = Number(input.outstandingLainnya) || 0;
  const outstanding =
    outstandingShopeeLazada + outstandingSap + outstandingJnt + outstandingTiktok + outstandingLainnya;

  const inventory = Number(input.inventory) || 0;

  // Rumus Total: Cash On Bank + Cash On Hand + Piutang Vendor - Utang Vendor + Outstanding + Inventory
  const total = cashOnBank + cashOnHand + piutangVendor - utangVendor + outstanding + inventory;

  return {
    cashOnBank,
    cashOnHand,
    kasBesar,
    kasKecil,
    piutangVendor,
    utangVendor,
    outstandingShopeeLazada,
    outstandingSap,
    outstandingJnt,
    outstandingTiktok,
    outstandingLainnya,
    outstanding,
    inventory,
    total,
  };
}

/**
 * Hitung ulang selisih inventory dan pertumbuhan berurutan untuk seluruh bulan pada satu brand.
 */
export async function hitungUlangPertumbuhanBrand(brandId: string) {
  const records = await prisma.pertumbuhanBisnis.findMany({
    where: { brandId },
    orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
  });

  for (let i = 0; i < records.length; i++) {
    const cur = records[i];
    let selisihInventory = 0;
    let pertumbuhanNominal = 0;
    let pertumbuhanPersen: number | null = null;

    if (i > 0) {
      const prev = records[i - 1];
      const curInv = Number(cur.inventory);
      const prevInv = Number(prev.inventory);
      selisihInventory = curInv - prevInv;

      const curTot = Number(cur.total);
      const prevTot = Number(prev.total);
      pertumbuhanNominal = curTot - prevTot;
      if (prevTot !== 0) {
        pertumbuhanPersen = (pertumbuhanNominal / Math.abs(prevTot)) * 100;
      }
    }

    const curSelisihInv = Number(cur.selisihInventory);
    const curPertumbNom = Number(cur.pertumbuhanNominal);
    const curPertumbPct = cur.pertumbuhanPersen ? Number(cur.pertumbuhanPersen) : null;

    if (
      Math.abs(curSelisihInv - selisihInventory) > 0.01 ||
      Math.abs(curPertumbNom - pertumbuhanNominal) > 0.01 ||
      curPertumbPct !== pertumbuhanPersen
    ) {
      await prisma.pertumbuhanBisnis.update({
        where: { id: cur.id },
        data: {
          selisihInventory: new Prisma.Decimal(selisihInventory.toFixed(2)),
          pertumbuhanNominal: new Prisma.Decimal(pertumbuhanNominal.toFixed(2)),
          pertumbuhanPersen: pertumbuhanPersen !== null ? new Prisma.Decimal(pertumbuhanPersen.toFixed(4)) : null,
        },
      });
    }
  }
}

/**
 * Cari atau buat brand berdasarkan nama.
 */
export async function dapatkanAtauBuatBrand(nama: string) {
  const kunci = kunciBrand(nama);
  let brand = await prisma.brand.findFirst({
    where: { OR: [{ kunci }, { nama: { equals: nama, mode: "insensitive" } }] },
  });
  if (!brand) {
    brand = await prisma.brand.create({
      data: {
        nama: nama.trim().toUpperCase(),
        kunci,
      },
    });
  }
  return brand;
}

function ambilNilaiSel(cell: ExcelJS.Cell | undefined): number {
  if (!cell || cell.value === null || cell.value === undefined) return 0;
  let val: any = cell.value;
  if (typeof val === "object") {
    if (val.result !== undefined && val.result !== null) val = val.result;
    else if ("formula" in val) val = 0;
  }
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function ambilTeksSel(cell: ExcelJS.Cell | undefined): string {
  if (!cell || cell.value === null || cell.value === undefined) return "";
  let val: any = cell.value;
  if (typeof val === "object") {
    if ("richText" in val && Array.isArray(val.richText)) {
      return val.richText.map((t: any) => t.text).join("").trim();
    }
    if (val.result !== undefined && val.result !== null) {
      return String(val.result).trim();
    }
  }
  return String(val).trim();
}

/**
 * Parsing file Excel Pertumbuhan Bisnis (seperti format CORETAN PROGRES _ Pertumbuhan Bisnis.xlsx).
 */
export async function imporPertumbuhanDariWorkbook(wb: ExcelJS.Workbook, userId?: string) {
  const brandDefinitions = [
    { namaBrand: "ZANEVA", aliasSheet: ["Zaneva", "Sheet: Zaneva"] },
    { namaBrand: "OBERBE", aliasSheet: ["Oberbe"] },
    { namaBrand: "BE SYAR'I", aliasSheet: ["Be Syari", "BeSyari", "Besyari", "BE SYAR'I", "BE SYARI'I"] },
    { namaBrand: "MUSWIM", aliasSheet: ["Muswim"] },
  ];

  let totalBarisDiimpor = 0;
  const brandIdsDiubah = new Set<string>();

  for (const def of brandDefinitions) {
    let ws: ExcelJS.Worksheet | undefined;
    for (const sheetName of def.aliasSheet) {
      ws = wb.getWorksheet(sheetName);
      if (ws) break;
    }
    if (!ws) {
      // Coba cari sheet yang memuat nama brand
      for (const w of wb.worksheets) {
        if (w.name.toLowerCase().includes(def.namaBrand.toLowerCase())) {
          ws = w;
          break;
        }
      }
    }
    if (!ws) continue;

    const brand = await dapatkanAtauBuatBrand(def.namaBrand);
    brandIdsDiubah.add(brand.id);

    // Cari baris tanggal / bulan (biasanya Row 2)
    let barisBulan = ws.getRow(2);
    let bulanKolom: { col: number; tahun: number; bulan: number }[] = [];

    function periksaBarisBulan(row: ExcelJS.Row) {
      const hasil: { col: number; tahun: number; bulan: number }[] = [];
      row.eachCell((cell, col) => {
        const val = cell.value;
        if (val instanceof Date) {
          hasil.push({ col, tahun: val.getFullYear(), bulan: val.getMonth() + 1 });
        } else if (typeof val === "string" && val.match(/^\d{4}-\d{2}/)) {
          const [y, m] = val.split("-").map(Number);
          if (y && m) hasil.push({ col, tahun: y, bulan: m });
        }
      });
      return hasil;
    }

    bulanKolom = periksaBarisBulan(barisBulan);
    if (bulanKolom.length === 0) {
      // Coba baris 1
      bulanKolom = periksaBarisBulan(ws.getRow(1));
    }

    if (bulanKolom.length === 0) continue;

    // Petakan baris label
    const mapLabel: { [key: string]: number } = {};
    const bankRows: { row: number; label: string }[] = [];

    let ketemuCob = false;
    for (let r = 1; r <= Math.min(ws.rowCount, 45); r++) {
      const row = ws.getRow(r);
      const l1 = ambilTeksSel(row.getCell(1)).toUpperCase();
      const l2 = ambilTeksSel(row.getCell(2)).toUpperCase();
      const label = (l2 || l1).replace(/\s+/g, " ").trim();

      if (label) {
        mapLabel[label] = r;

        // Kumpulkan akun-akun bank sebelum baris CASH ON BANK
        if (label === "CASH ON BANK") {
          ketemuCob = true;
        } else if (!ketemuCob && r >= 3) {
          if (!label.includes("KAS") && !label.includes("TOTAL") && !label.includes("PIUTANG")) {
            bankRows.push({ row: r, label: l2 || l1 });
          }
        }
      }
    }

    // Untuk setiap bulan, ekstrak nilai dan simpan ke database
    for (const b of bulanKolom) {
      const col = b.col;

      // Bank items
      const detailBank: DetailBankItem[] = [];
      for (const br of bankRows) {
        const nom = ambilNilaiSel(ws.getRow(br.row).getCell(col));
        detailBank.push({ nama: br.label, nominal: nom });
      }

      // Kas
      const rKasBesar = mapLabel["KAS BESAR"];
      const rKasKecil = mapLabel["KAS KECIL"];
      const kasBesar = rKasBesar ? ambilNilaiSel(ws.getRow(rKasBesar).getCell(col)) : 0;
      const kasKecil = rKasKecil ? ambilNilaiSel(ws.getRow(rKasKecil).getCell(col)) : 0;

      // Piutang & Utang Vendor
      const rPiutang = mapLabel["PIUTANG VENDOR"];
      const rUtang = mapLabel["UTANG VENDOR"];
      const piutangVendor = rPiutang ? ambilNilaiSel(ws.getRow(rPiutang).getCell(col)) : 0;
      const utangVendor = rUtang ? ambilNilaiSel(ws.getRow(rUtang).getCell(col)) : 0;

      // Outstanding
      const rShopeeLazada = mapLabel["SHOPEE & LAZADA"];
      const rSap = mapLabel["SAP"];
      const rJnt = mapLabel["JNT"];
      const rTiktok = mapLabel["TIKTOK"];
      const outstandingShopeeLazada = rShopeeLazada ? ambilNilaiSel(ws.getRow(rShopeeLazada).getCell(col)) : 0;
      const outstandingSap = rSap ? ambilNilaiSel(ws.getRow(rSap).getCell(col)) : 0;
      const outstandingJnt = rJnt ? ambilNilaiSel(ws.getRow(rJnt).getCell(col)) : 0;
      const outstandingTiktok = rTiktok ? ambilNilaiSel(ws.getRow(rTiktok).getCell(col)) : 0;

      // Inventory
      const rInventory = mapLabel["INVENTORY"];
      const inventory = rInventory ? ambilNilaiSel(ws.getRow(rInventory).getCell(col)) : 0;

      // Hutang lainnya & Catatan
      let hutangLainnya = 0;
      let keteranganHutang = "";
      for (const k of Object.keys(mapLabel)) {
        if (k.startsWith("HUTANG KE")) {
          const rowHutang = mapLabel[k];
          hutangLainnya = ambilNilaiSel(ws.getRow(rowHutang).getCell(col));
          keteranganHutang = k;
          break;
        }
      }

      // Catatan di sel-sel bawah atau baris 28
      let catatan = "";
      const rowCatatan1 = ws.getRow(28)?.getCell(col);
      const rowCatatan2 = ws.getRow(29)?.getCell(col);
      const rowCatatan3 = ws.getRow(11)?.getCell(col);
      const cat1 = ambilTeksSel(rowCatatan1);
      const cat2 = ambilTeksSel(rowCatatan2);
      const cat3 = ambilTeksSel(rowCatatan3);
      if (cat1.startsWith("*")) catatan = cat1;
      else if (cat2.startsWith("*")) catatan = cat2;
      else if (cat3.startsWith("*")) catatan = cat3;

      // Subtotal calculation
      const subtotals = hitungSubtotal({
        detailBank,
        kasBesar,
        kasKecil,
        piutangVendor,
        utangVendor,
        outstandingShopeeLazada,
        outstandingSap,
        outstandingJnt,
        outstandingTiktok,
        inventory,
      });

      // Abaikan jika semua nilai 0 (kolom kosong/belum diisi seperti proyeksi masa depan)
      const isSemuaNol =
        subtotals.cashOnBank === 0 &&
        subtotals.cashOnHand === 0 &&
        subtotals.piutangVendor === 0 &&
        subtotals.utangVendor === 0 &&
        subtotals.outstanding === 0 &&
        subtotals.inventory === 0 &&
        hutangLainnya === 0;

      if (isSemuaNol) continue;

      // Upsert ke database
      await prisma.pertumbuhanBisnis.upsert({
        where: {
          brandId_tahun_bulan: {
            brandId: brand.id,
            tahun: b.tahun,
            bulan: b.bulan,
          },
        },
        create: {
          brandId: brand.id,
          tahun: b.tahun,
          bulan: b.bulan,
          detailBank: detailBank as unknown as Prisma.InputJsonValue,
          cashOnBank: new Prisma.Decimal(subtotals.cashOnBank.toFixed(2)),
          kasBesar: new Prisma.Decimal(subtotals.kasBesar.toFixed(2)),
          kasKecil: new Prisma.Decimal(subtotals.kasKecil.toFixed(2)),
          cashOnHand: new Prisma.Decimal(subtotals.cashOnHand.toFixed(2)),
          piutangVendor: new Prisma.Decimal(subtotals.piutangVendor.toFixed(2)),
          utangVendor: new Prisma.Decimal(subtotals.utangVendor.toFixed(2)),
          outstandingShopeeLazada: new Prisma.Decimal(subtotals.outstandingShopeeLazada.toFixed(2)),
          outstandingSap: new Prisma.Decimal(subtotals.outstandingSap.toFixed(2)),
          outstandingJnt: new Prisma.Decimal(subtotals.outstandingJnt.toFixed(2)),
          outstandingTiktok: new Prisma.Decimal(subtotals.outstandingTiktok.toFixed(2)),
          outstandingLainnya: new Prisma.Decimal(0),
          outstanding: new Prisma.Decimal(subtotals.outstanding.toFixed(2)),
          inventory: new Prisma.Decimal(subtotals.inventory.toFixed(2)),
          selisihInventory: new Prisma.Decimal(0),
          total: new Prisma.Decimal(subtotals.total.toFixed(2)),
          pertumbuhanNominal: new Prisma.Decimal(0),
          pertumbuhanPersen: null,
          hutangLainnya: new Prisma.Decimal(hutangLainnya.toFixed(2)),
          keteranganHutang: keteranganHutang || null,
          catatan: catatan || null,
          dibuatOlehId: userId,
        },
        update: {
          detailBank: detailBank as unknown as Prisma.InputJsonValue,
          cashOnBank: new Prisma.Decimal(subtotals.cashOnBank.toFixed(2)),
          kasBesar: new Prisma.Decimal(subtotals.kasBesar.toFixed(2)),
          kasKecil: new Prisma.Decimal(subtotals.kasKecil.toFixed(2)),
          cashOnHand: new Prisma.Decimal(subtotals.cashOnHand.toFixed(2)),
          piutangVendor: new Prisma.Decimal(subtotals.piutangVendor.toFixed(2)),
          utangVendor: new Prisma.Decimal(subtotals.utangVendor.toFixed(2)),
          outstandingShopeeLazada: new Prisma.Decimal(subtotals.outstandingShopeeLazada.toFixed(2)),
          outstandingSap: new Prisma.Decimal(subtotals.outstandingSap.toFixed(2)),
          outstandingJnt: new Prisma.Decimal(subtotals.outstandingJnt.toFixed(2)),
          outstandingTiktok: new Prisma.Decimal(subtotals.outstandingTiktok.toFixed(2)),
          outstanding: new Prisma.Decimal(subtotals.outstanding.toFixed(2)),
          inventory: new Prisma.Decimal(subtotals.inventory.toFixed(2)),
          total: new Prisma.Decimal(subtotals.total.toFixed(2)),
          hutangLainnya: new Prisma.Decimal(hutangLainnya.toFixed(2)),
          keteranganHutang: keteranganHutang || null,
          catatan: catatan || null,
          diubahOlehId: userId,
        },
      });

      totalBarisDiimpor++;
    }
  }

  // Hitung ulang pertumbuhan untuk setiap brand yang diubah
  for (const bId of brandIdsDiubah) {
    await hitungUlangPertumbuhanBrand(bId);
  }

  return { totalBarisDiimpor, totalBrand: brandIdsDiubah.size };
}

/**
 * Buat Workbook Excel untuk diekspor.
 */
export async function buatExcelPertumbuhanBisnis() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Zaneva Finance System";
  wb.created = new Date();

  // Ambil semua brand non-dummy dan data
  const brands = await prisma.brand.findMany({
    where: {
      NOT: { nama: { startsWith: "[DUMMY]" } },
    },
    orderBy: { nama: "asc" },
  });

  const records = await prisma.pertumbuhanBisnis.findMany({
    include: { brand: true },
    orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
  });

  // Kumpulkan daftar periode unik
  const periodeSet = new Set<string>();
  records.forEach((r) => {
    periodeSet.add(`${r.tahun}-${String(r.bulan).padStart(2, "0")}`);
  });
  const daftarPeriode = Array.from(periodeSet).sort();

  // Sheet 1: Konsolidasi
  const wsKon = wb.addWorksheet("Konsolidasi");
  wsKon.views = [{ showGridLines: true }];

  // Header periode
  const rowH1 = wsKon.addRow(["KONSOLIDASI PERTUMBUHAN BISNIS"]);
  rowH1.font = { bold: true, size: 14 };

  const headerKolom = ["Keterangan", ...daftarPeriode];
  const rowHeader = wsKon.addRow(headerKolom);
  rowHeader.font = { bold: true };
  rowHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  const dataByBrandPeriode: { [brandId: string]: { [periode: string]: (typeof records)[0] } } = {};
  for (const r of records) {
    if (!dataByBrandPeriode[r.brandId]) dataByBrandPeriode[r.brandId] = {};
    const key = `${r.tahun}-${String(r.bulan).padStart(2, "0")}`;
    dataByBrandPeriode[r.brandId][key] = r;
  }

  // Baris per brand: Total & Pertumbuhan
  for (const brand of brands) {
    const brandData = dataByBrandPeriode[brand.id] || {};
    // Baris Total Brand
    const rowTotal: (string | number)[] = [`${brand.nama} - Total`];
    // Baris Pertumbuhan Brand
    const rowPertumb: (string | number)[] = [`${brand.nama} - Pertumbuhan`];

    for (const p of daftarPeriode) {
      const rec = brandData[p];
      rowTotal.push(rec ? Number(rec.total) : 0);
      rowPertumb.push(rec ? Number(rec.pertumbuhanNominal) : 0);
    }

    const r1 = wsKon.addRow(rowTotal);
    r1.font = { bold: true };
    const r2 = wsKon.addRow(rowPertumb);
    r2.font = { italic: true };
  }

  // Baris TOTAL KONSOLIDASI GABUNGAN
  const rowGrandTotal: (string | number)[] = ["TOTAL KONSOLIDASI"];
  const rowGrandPertumb: (string | number)[] = ["PERTUMBUHAN KONSOLIDASI"];
  let prevGrandTotal = 0;

  for (let i = 0; i < daftarPeriode.length; i++) {
    const p = daftarPeriode[i];
    let sumTotal = 0;
    for (const b of brands) {
      const rec = dataByBrandPeriode[b.id]?.[p];
      if (rec) sumTotal += Number(rec.total);
    }
    rowGrandTotal.push(sumTotal);

    if (i === 0) {
      rowGrandPertumb.push(0);
    } else {
      rowGrandPertumb.push(sumTotal - prevGrandTotal);
    }
    prevGrandTotal = sumTotal;
  }

  wsKon.addRow([]);
  const rGT = wsKon.addRow(rowGrandTotal);
  rGT.font = { bold: true, size: 11, color: { argb: "FF0F172A" } };
  rGT.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFCBD5E1" } };

  const rGP = wsKon.addRow(rowGrandPertumb);
  rGP.font = { bold: true, italic: true };

  // Format angka di sheet Konsolidasi
  for (let r = 2; r <= wsKon.rowCount; r++) {
    const row = wsKon.getRow(r);
    for (let c = 2; c <= headerKolom.length; c++) {
      const cell = row.getCell(c);
      if (typeof cell.value === "number") {
        cell.numFmt = "#,##0";
      }
    }
  }

  // Sheet detail untuk masing-masing Brand
  for (const brand of brands) {
    const brandRecords = records.filter((r) => r.brandId === brand.id);
    if (brandRecords.length === 0) continue;

    const wsBrand = wb.addWorksheet(brand.nama.slice(0, 31));
    wsBrand.views = [{ showGridLines: true }];

    const brandPeriodes = brandRecords.map((r) => `${r.tahun}-${String(r.bulan).padStart(2, "0")}`);
    const bHeader = ["Komponen", ...brandPeriodes];

    const rTitle = wsBrand.addRow([`REKAP PERTUMBUHAN BISNIS - ${brand.nama}`]);
    rTitle.font = { bold: true, size: 13 };

    const rHead = wsBrand.addRow(bHeader);
    rHead.font = { bold: true };
    rHead.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

    // Baris Cash On Bank
    wsBrand.addRow(["Cash On Bank", ...brandRecords.map((r) => Number(r.cashOnBank))]);
    // Baris Cash On Hand
    wsBrand.addRow(["Cash On Hand", ...brandRecords.map((r) => Number(r.cashOnHand))]);
    // Baris Piutang Vendor
    wsBrand.addRow(["Piutang Vendor", ...brandRecords.map((r) => Number(r.piutangVendor))]);
    // Baris Utang Vendor
    wsBrand.addRow(["Utang Vendor", ...brandRecords.map((r) => Number(r.utangVendor))]);
    // Baris Outstanding
    wsBrand.addRow(["Outstanding", ...brandRecords.map((r) => Number(r.outstanding))]);
    // Baris Inventory
    wsBrand.addRow(["Inventory", ...brandRecords.map((r) => Number(r.inventory))]);
    // Baris Selisih Inventory
    wsBrand.addRow(["Selisih Inventory", ...brandRecords.map((r) => Number(r.selisihInventory))]);

    // Baris TOTAL
    const rTot = wsBrand.addRow(["TOTAL", ...brandRecords.map((r) => Number(r.total))]);
    rTot.font = { bold: true };
    rTot.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };

    // Baris Pertumbuhan
    const rPert = wsBrand.addRow(["Pertumbuhan", ...brandRecords.map((r) => Number(r.pertumbuhanNominal))]);
    rPert.font = { bold: true, italic: true };

    // Baris Hutang Lainnya
    const adaHutangLain = brandRecords.some((r) => Number(r.hutangLainnya) > 0);
    if (adaHutangLain) {
      const ketHutang = brandRecords.find((r) => r.keteranganHutang)?.keteranganHutang || "Hutang ke Pusat";
      wsBrand.addRow([ketHutang, ...brandRecords.map((r) => Number(r.hutangLainnya))]);
    }

    // Format angka
    for (let r = 2; r <= wsBrand.rowCount; r++) {
      const row = wsBrand.getRow(r);
      for (let c = 2; c <= bHeader.length; c++) {
        const cell = row.getCell(c);
        if (typeof cell.value === "number") {
          cell.numFmt = "#,##0";
        }
      }
    }
  }

  // Atur lebar kolom otomatis
  wb.eachSheet((ws) => {
    ws.columns.forEach((col, idx) => {
      if (idx === 0) col.width = 30;
      else col.width = 16;
    });
  });

  return wb;
}
