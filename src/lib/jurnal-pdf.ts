import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

export interface BarisPdf {
  kode: string;
  nama: string;
  debit: number;
  kredit: number;
}

export interface JurnalPdf {
  nomor: number;
  tanggal: string;
  keterangan: string;
  brand: string;
  dibalik: boolean;
  pembalikTanggal: string | null;
  asalNomor: number | null;
  baris: BarisPdf[];
}

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function tanggalPanjang(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${BULAN[Number(m) - 1]} ${y}`;
}

function uang(n: number) {
  if (!n) return "-";
  return new Intl.NumberFormat("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    .format(n)
    .replace(/\u00a0|\u202f/g, " ");
}

function bungkus(font: PDFFont, teks: string, ukuran: number, lebar: number) {
  const kata = teks.split(/\s+/).filter(Boolean);
  const baris: string[] = [];
  let sekarang = "";
  for (const k of kata) {
    const calon = sekarang ? `${sekarang} ${k}` : k;
    if (font.widthOfTextAtSize(calon, ukuran) <= lebar) sekarang = calon;
    else {
      if (sekarang) baris.push(sekarang);
      sekarang = k;
    }
  }
  if (sekarang) baris.push(sekarang);
  return baris.length ? baris : [""];
}

const NAVY = rgb(0.09, 0.2, 0.33);
const GARIS = rgb(0.75, 0.78, 0.82);
const ABU = rgb(0.35, 0.38, 0.42);
const HEADER = rgb(0.93, 0.95, 0.96);
const PUTIH = rgb(1, 1, 1);

export async function buatPdfJurnal(input: {
  dari: string;
  sampai: string;
  brand: string | null;
  jurnal: JurnalPdf[];
}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const biasa = await doc.embedFont(StandardFonts.Helvetica);
  const tebal = await doc.embedFont(StandardFonts.HelveticaBold);
  const m = 40;
  const lebar = 595.28;
  const tinggi = 841.89;
  const kanan = lebar - m;
  const kolDebit = 400;
  const kolKredit = 490;

  let page = doc.addPage([lebar, tinggi]);
  let y = tinggi - m;

  const halamanBaru = (lanjutan: boolean) => {
    page = doc.addPage([lebar, tinggi]);
    y = tinggi - m;
    if (lanjutan) {
      page.drawText("Jurnal Penyesuaian (lanjutan)", { x: m, y, size: 9, font: tebal, color: ABU });
      y -= 16;
    }
  };

  const ruang = (butuh: number) => {
    if (y - butuh < 48) halamanBaru(true);
  };

  const judul = (teks: string, ukuran: number, font: PDFFont, warna = NAVY) => {
    page.drawText(teks, { x: m, y, size: ukuran, font, color: warna });
    y -= ukuran + 6;
  };

  judul("ZANEVA", 11, tebal);
  judul("JURNAL PENYESUAIAN", 16, tebal);
  page.drawText(
    `${tanggalPanjang(input.dari)} - ${tanggalPanjang(input.sampai)}`,
    { x: m, y, size: 10, font: biasa, color: NAVY }
  );
  y -= 14;
  page.drawText(input.brand ? `Brand ${input.brand}` : "Semua brand", {
    x: m,
    y,
    size: 10,
    font: biasa,
    color: ABU,
  });
  y -= 14;
  page.drawText("Tidak mengubah saldo bank. Masuk ke Laba Rugi dan Neraca, tidak masuk Arus Kas.", {
    x: m,
    y,
    size: 8,
    font: biasa,
    color: ABU,
  });
  y -= 18;

  const gambarKepalaKolom = () => {
    ruang(22);
    page.drawRectangle({ x: m, y: y - 4, width: kanan - m, height: 16, color: HEADER });
    page.drawText("Akun", { x: m + 6, y, size: 8, font: tebal, color: NAVY });
    page.drawText("Debit", { x: kolDebit, y, size: 8, font: tebal, color: NAVY });
    page.drawText("Kredit", { x: kolKredit, y, size: 8, font: tebal, color: NAVY });
    y -= 18;
  };

  let grandDebit = 0;
  let grandKredit = 0;

  if (input.jurnal.length === 0) {
    page.drawText("Tidak ada jurnal penyesuaian pada periode ini.", { x: m, y, size: 10, font: biasa, color: ABU });
    y -= 16;
  }

  for (const j of input.jurnal) {
    const catatan = [
      j.asalNomor ? `Jurnal pembalik dari JP-${j.asalNomor}` : "",
      j.dibalik && j.pembalikTanggal ? `Dibalik ${tanggalPanjang(j.pembalikTanggal)}` : "",
    ].filter(Boolean).join("  |  ");
    const ket = bungkus(biasa, j.keterangan, 9, kanan - m - 12);
    ruang(36 + ket.length * 12 + 20);
    page.drawRectangle({ x: m, y: y - 6, width: kanan - m, height: 18, color: NAVY });
    page.drawText(`JP-${j.nomor}   ${tanggalPanjang(j.tanggal)}   ${j.brand}`, {
      x: m + 6,
      y,
      size: 9,
      font: tebal,
      color: PUTIH,
    });
    y -= 20;
    for (const baris of ket) {
      page.drawText(baris, { x: m + 6, y, size: 9, font: biasa, color: NAVY });
      y -= 12;
    }
    if (catatan) {
      page.drawText(catatan, { x: m + 6, y, size: 8, font: biasa, color: ABU });
      y -= 12;
    }
    y -= 4;
    gambarKepalaKolom();

    let debit = 0;
    let kredit = 0;
    for (const b of j.baris) {
      const nama = bungkus(biasa, `(${b.kode}) ${b.nama}`, 9, kolDebit - m - 16);
      ruang(nama.length * 12 + 4);
      nama.forEach((baris, i) => {
        page.drawText(baris, { x: m + 6, y, size: 9, font: biasa, color: rgb(0.1, 0.1, 0.12) });
        if (i === 0) {
          page.drawText(uang(b.debit), { x: kolDebit, y, size: 9, font: biasa, color: rgb(0.1, 0.1, 0.12) });
          page.drawText(uang(b.kredit), { x: kolKredit, y, size: 9, font: biasa, color: rgb(0.1, 0.1, 0.12) });
        }
        y -= 12;
      });
      debit += b.debit;
      kredit += b.kredit;
    }
    ruang(18);
    page.drawLine({ start: { x: m, y: y + 8 }, end: { x: kanan, y: y + 8 }, thickness: 0.6, color: GARIS });
    page.drawText("Total", { x: m + 6, y, size: 9, font: tebal, color: NAVY });
    page.drawText(uang(debit), { x: kolDebit, y, size: 9, font: tebal, color: NAVY });
    page.drawText(uang(kredit), { x: kolKredit, y, size: 9, font: tebal, color: NAVY });
    y -= 22;
    grandDebit += debit;
    grandKredit += kredit;
  }

  ruang(28);
  page.drawRectangle({ x: m, y: y - 6, width: kanan - m, height: 18, color: HEADER });
  page.drawText("Grand total", { x: m + 6, y, size: 9, font: tebal, color: NAVY });
  page.drawText(uang(grandDebit), { x: kolDebit, y, size: 9, font: tebal, color: NAVY });
  page.drawText(uang(grandKredit), { x: kolKredit, y, size: 9, font: tebal, color: NAVY });

  const pages = doc.getPages();
  pages.forEach((p: PDFPage, i) => {
    p.drawText(`Halaman ${i + 1} dari ${pages.length}`, {
      x: kanan - 90,
      y: 24,
      size: 8,
      font: biasa,
      color: ABU,
    });
    p.drawText("Jurnal penyesuaian - bukan mutasi bank", {
      x: m,
      y: 24,
      size: 8,
      font: biasa,
      color: ABU,
    });
  });

  return doc.save();
}
