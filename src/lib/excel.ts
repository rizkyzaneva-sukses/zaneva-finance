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

/* ───────────────────────── Multi-sheet (banyak rekening) ───────────────────────── */

export interface RekapPerRekening {
  /** Nama sheet — sudah dibersihkan / boleh belum, nanti diaman-kan lagi di sini. */
  namaSheet: string;
  /** Label lengkap untuk kolom Rekening di sheet Ringkasan. */
  label: string;
  baris: BarisRekapExcel[];
  saldoAwal?: { tanggal: Date | string; nominal: number };
}

export interface OpsiRekapMulti {
  dari?: string | null;
  sampai?: string | null;
}

const HIJAU_MUDA = "FFDCFCE7";
const KUNING_MUDA = "FFFEF9C3";

function tulisHeader(ws: ExcelJS.Worksheet) {
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
  });
}

function rapikanKolom(ws: ExcelJS.Worksheet) {
  for (const key of ["uangMasuk", "uangKeluar", "saldo"]) {
    ws.getColumn(key).numFmt = "#,##0.00";
    ws.getColumn(key).alignment = { horizontal: "right" };
  }
  ws.getColumn("no").alignment = { horizontal: "center" };
}

/** Daftar kolom standar rekap. Dipakai semua sheet supaya lebar kolom seragam. */
const KOLOM_REKAP: Partial<ExcelJS.Column>[] = [
  { header: "No.", key: "no", width: 6 },
  { header: "Tanggal", key: "tanggal", width: 18 },
  { header: "Kode", key: "kode", width: 10 },
  { header: "Keterangan", key: "keterangan", width: 52 },
  { header: "Uang masuk", key: "uangMasuk", width: 18 },
  { header: "Uang keluar", key: "uangKeluar", width: 18 },
  { header: "Saldo", key: "saldo", width: 20 },
  { header: "Catatan", key: "catatan", width: 30 },
];

/**
 * Satu file Excel berisi satu sheet per rekening + sheet "Ringkasan" di depan.
 *
 * Dipakai fitur "download rekapan multi rekening" untuk staff: satu klik, satu
 * file, semua rekening yang dipilih punya tabnya sendiri, lalu ada rekap total
 * di tab pertama untuk dicek cepat.
 */
export async function buildRekapWorkbookMulti(
  daftar: RekapPerRekening[],
  opsi: OpsiRekapMulti = {}
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Zaneva Finance";
  wb.created = new Date();

  /* ── Sheet Ringkasan ─────────────────────────────────────────────────── */
  const ringkas = wb.addWorksheet("Ringkasan");
  ringkas.columns = [
    { header: "Rekening", key: "rekening", width: 44 },
    { header: "Jumlah baris", key: "jumlah", width: 14 },
    { header: "Total masuk", key: "masuk", width: 20 },
    { header: "Total keluar", key: "keluar", width: 20 },
    { header: "Saldo akhir", key: "saldo", width: 20 },
  ];
  tulisHeader(ringkas);

  const periode =
    opsi.dari || opsi.sampai
      ? `Periode: ${opsi.dari ? formatTanggal(opsi.dari) : "awal"} — ${opsi.sampai ? formatTanggal(opsi.sampai) : "akhir"}`
      : "Periode: seluruh data";

  ringkas.spliceRows(1, 0, [`Rekap ${daftar.length} Rekening`], [periode], []);
  ringkas.getRow(1).font = { bold: true, size: 14 };
  ringkas.getRow(2).font = { italic: true, color: { argb: "FF6B7280" } };
  // spliceRows menggeser header asli ke baris 4 — ambil ulang agar styling benar.
  const headerRingkas = ringkas.getRow(4);
  headerRingkas.font = { bold: true };
  headerRingkas.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ABU } };
  });

  const total = { jumlah: 0, masuk: 0, keluar: 0 };
  for (const r of daftar) {
    const masuk = r.baris.reduce((a, b) => a + b.uangMasuk, 0);
    const keluar = r.baris.reduce((a, b) => a + b.uangKeluar, 0);
    const saldoAkhir = r.baris.length > 0 ? r.baris[r.baris.length - 1].saldo : (r.saldoAwal?.nominal ?? 0);
    total.jumlah += r.baris.length;
    total.masuk += masuk;
    total.keluar += keluar;

    const row = ringkas.addRow({
      rekening: r.label,
      jumlah: r.baris.length,
      masuk,
      keluar,
      saldo: saldoAkhir,
    });
    if (r.baris.length === 0) {
      row.font = { italic: true, color: { argb: "FF6B7280" } };
    }
  }

  const barisTotal = ringkas.addRow({
    rekening: `TOTAL (${daftar.length} rekening)`,
    jumlah: total.jumlah,
    masuk: total.masuk,
    keluar: total.keluar,
    saldo: null,
  });
  barisTotal.font = { bold: true };
  barisTotal.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: KUNING_MUDA } };
  });

  for (const key of ["masuk", "keluar", "saldo"]) {
    ringkas.getColumn(key).numFmt = "#,##0.00";
    ringkas.getColumn(key).alignment = { horizontal: "right" };
  }
  ringkas.getColumn("jumlah").alignment = { horizontal: "right" };
  ringkas.views = [{ state: "frozen", ySplit: 4 }];

  /* ── Satu sheet per rekening ─────────────────────────────────────────── */
  const dipakai = new Set<string>(["Ringkasan"]);
  for (const r of daftar) {
    // Nama sheet harus unik — dua rekening bernama sama tetap butuh dua tab.
    let nama = namaSheetAman(r.namaSheet);
    if (dipakai.has(nama)) {
      let i = 2;
      const akar = nama.slice(0, 28);
      while (dipakai.has(`${akar} ${i}`)) i += 1;
      nama = `${akar} ${i}`;
    }
    dipakai.add(nama);

    const ws = wb.addWorksheet(nama);
    ws.columns = KOLOM_REKAP;
    tulisHeader(ws);

    let no = 0;
    if (r.saldoAwal) {
      no += 1;
      ws.addRow({
        no,
        tanggal: formatTanggal(r.saldoAwal.tanggal),
        kode: "0000",
        keterangan: "Saldo",
        uangMasuk: r.saldoAwal.nominal,
        uangKeluar: null,
        saldo: r.saldoAwal.nominal,
        catatan: "",
      });
    }

    for (const b of r.baris) {
      no += 1;
      const row = ws.addRow({
        no,
        tanggal: formatTanggal(b.tanggal),
        kode: b.kode,
        keterangan: b.keterangan,
        uangMasuk: b.uangMasuk || null,
        uangKeluar: b.uangKeluar || null,
        saldo: b.saldo,
        catatan: b.catatan,
      });
      if (b.yakin === false) {
        row.eachCell((cell) => {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: MERAH_MUDA } };
        });
      }
    }

    if (r.baris.length === 0) {
      const kosong = ws.addRow({ keterangan: "Tidak ada transaksi pada periode ini" });
      kosong.font = { italic: true, color: { argb: "FF6B7280" } };
      kosong.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIJAU_MUDA } };
      });
    }

    rapikanKolom(ws);
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
