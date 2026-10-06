import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { MandiriMeta, MandiriParseResult, MandiriTransaction } from "@/lib/types";

interface Item {
  text: string;
  x: number;
  y: number;
}

interface Row {
  y: number;
  no: string;
  tanggal: string;
  keterangan: string;
  nominal: string;
  saldo: string;
}

const Y_TOLERANCE = 2.2;

// Kolom default hasil pengukuran dari template e-Statement Mandiri.
// Dipakai sebagai fallback kalau deteksi otomatis dari header gagal.
const DEFAULT_BOUNDS = { b1: 36, b2: 88, b3: 252, b4: 451.5 };

function parseIdNumber(raw: string): number {
  const cleaned = raw.replace(/[^\d,.\-+]/g, "");
  const negative = cleaned.startsWith("-");
  const digitsOnly = cleaned.replace(/[-+]/g, "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(digitsOnly);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

function isDateLine(s: string): boolean {
  return /^\d{1,2}\s+[A-Za-z]{3,}\s+\d{4}$/.test(s.trim());
}

function isTimeLine(s: string): boolean {
  return /^\d{2}:\d{2}:\d{2}\s*WIB$/i.test(s.trim());
}

async function extractItemsPerPage(data: Uint8Array, password?: string): Promise<Item[][]> {
  let doc;
  try {
    doc = await getDocument({ data, password: password || undefined, verbosity: 0 }).promise;
  } catch (err) {
    const name = (err as { name?: string })?.name;
    if (name === "PasswordException") {
      throw new Error("Password PDF salah atau belum diisi");
    }
    throw err;
  }

  const pages: Item[][] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const raw of content.items as Array<{ str?: string; transform: number[] }>) {
      const text = (raw.str ?? "").trim();
      if (!text) continue;
      items.push({ text, x: raw.transform[4], y: raw.transform[5] });
    }
    pages.push(items);
  }
  return pages;
}

function clusterRows(items: Item[]): { y: number; items: Item[] }[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const clusters: { y: number; items: Item[] }[] = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(last.y - item.y) <= Y_TOLERANCE) {
      last.items.push(item);
      last.y = (last.y * (last.items.length - 1) + item.y) / last.items.length;
    } else {
      clusters.push({ y: item.y, items: [item] });
    }
  }
  for (const c of clusters) c.items.sort((a, b) => a.x - b.x);
  return clusters;
}

function detectColumnBounds(items: Item[]): typeof DEFAULT_BOUNDS {
  const find = (labels: string[]) =>
    items.find((it) => labels.some((l) => it.text.toLowerCase() === l.toLowerCase()));

  const noX = find(["No"])?.x;
  const tanggalX = find(["Tanggal", "Date"])?.x;
  const keteranganX = find(["Keterangan", "Remarks"])?.x;
  const nominalX = find(["Nominal (IDR)", "Amount (IDR)"])?.x;
  const saldoX = find(["Saldo (IDR)", "Balance (IDR)"])?.x;

  if (
    noX === undefined ||
    tanggalX === undefined ||
    keteranganX === undefined ||
    nominalX === undefined ||
    saldoX === undefined
  ) {
    return DEFAULT_BOUNDS;
  }

  return {
    b1: (noX + tanggalX) / 2,
    b2: (tanggalX + keteranganX) / 2,
    b3: (keteranganX + nominalX) / 2,
    b4: (nominalX + saldoX) / 2,
  };
}

function rowFromCluster(cluster: Item[], bounds: typeof DEFAULT_BOUNDS): Row {
  const row: Row = { y: 0, no: "", tanggal: "", keterangan: "", nominal: "", saldo: "" };
  const parts: Record<keyof Omit<Row, "y">, string[]> = {
    no: [],
    tanggal: [],
    keterangan: [],
    nominal: [],
    saldo: [],
  };
  for (const item of cluster) {
    if (item.x < bounds.b1) parts.no.push(item.text);
    else if (item.x < bounds.b2) parts.tanggal.push(item.text);
    else if (item.x < bounds.b3) parts.keterangan.push(item.text);
    else if (item.x < bounds.b4) parts.nominal.push(item.text);
    else parts.saldo.push(item.text);
  }
  row.no = parts.no.join(" ").trim();
  row.tanggal = parts.tanggal.join(" ").trim();
  row.keterangan = parts.keterangan.join(" ").trim();
  row.nominal = parts.nominal.join(" ").trim();
  row.saldo = parts.saldo.join(" ").trim();
  return row;
}

function findLabelValue(items: Item[], labelPatterns: RegExp[], yTolerance = 1.5): string | null {
  for (const item of items) {
    if (labelPatterns.some((re) => re.test(item.text))) {
      const sameRow = items.filter(
        (it) => it !== item && Math.abs(it.y - item.y) <= yTolerance && it.x > item.x
      );
      sameRow.sort((a, b) => a.x - b.x);
      const value = sameRow.find((it) => /[0-9]/.test(it.text) && it.text !== ":");
      if (value) return value.text;
    }
  }
  return null;
}

function extractMeta(allItems: Item[]): MandiriMeta {
  const saldoAwalStr = findLabelValue(allItems, [/Saldo Awal/i]);
  const saldoAkhirStr = findLabelValue(allItems, [/Saldo Akhir/i, /Closing Balance/i]);
  const nomorRekening = findLabelValue(allItems, [/Nomor Rekening/i, /Account Number/i]);
  const periode = findLabelValue(allItems, [/Periode\/Period/i, /^Periode\//i]);

  const namaLabel = allItems.find((it) => /^Nama\//i.test(it.text));
  let nama: string | undefined;
  if (namaLabel) {
    const isLabelNoise = (t: string) => /[/:]/.test(t) || /^(Periode|Period|Name|Dicetak|Issued)/i.test(t);
    const candidates = allItems
      .filter(
        (it) =>
          it.x > namaLabel.x + 20 &&
          it.x < namaLabel.x + 150 &&
          it.y <= namaLabel.y + 2 &&
          it.y > namaLabel.y - 16 &&
          !isLabelNoise(it.text)
      )
      .sort((a, b) => b.y - a.y)
      .map((it) => it.text);
    nama = candidates.join(" ").trim() || undefined;
  }

  return {
    nomorRekening: nomorRekening ?? undefined,
    nama,
    periode: periode ?? undefined,
    saldoAwal: saldoAwalStr ? parseIdNumber(saldoAwalStr) : undefined,
    saldoAkhir: saldoAkhirStr ? parseIdNumber(saldoAkhirStr) : undefined,
  };
}

export async function parseMandiriPdf(
  data: Uint8Array,
  password: string
): Promise<MandiriParseResult> {
  const pages = await extractItemsPerPage(data, password);
  const allItems = pages.flat();
  const meta = extractMeta(allItems);

  const transactions: MandiriTransaction[] = [];

  for (const pageItems of pages) {
    if (pageItems.length === 0) continue;
    const bounds = detectColumnBounds(pageItems);

    const headerItem = pageItems.find((it) => /keterangan|remarks/i.test(it.text));
    const footerItem = pageItems.find((it) => /batas akhir transaksi|disclaimer/i.test(it.text));
    const tableTop = headerItem ? headerItem.y - 2 : Math.max(...pageItems.map((i) => i.y));
    const tableBottom = footerItem ? footerItem.y : Math.min(...pageItems.map((i) => i.y)) - 1;

    const tableItems = pageItems.filter((it) => it.y < tableTop && it.y > tableBottom);
    const clusters = clusterRows(tableItems);

    interface Draft {
      dateStr: string;
      timeStr: string;
      descParts: string[];
      nominalStr: string;
      saldoStr: string;
    }
    let current: Draft | null = null;
    const drafts: Draft[] = [];

    for (const cluster of clusters) {
      const row = rowFromCluster(cluster.items, bounds);

      if (isDateLine(row.tanggal)) {
        if (current) drafts.push(current);
        current = { dateStr: row.tanggal, timeStr: "", descParts: [], nominalStr: "", saldoStr: "" };
        if (row.keterangan) current.descParts.push(row.keterangan);
      } else if (isTimeLine(row.tanggal)) {
        if (!current) continue;
        current.timeStr = row.tanggal.replace(/\s*WIB$/i, "");
        if (row.keterangan) current.descParts.push(row.keterangan);
      } else if (row.keterangan && current) {
        current.descParts.push(row.keterangan);
      }

      if (row.no && row.nominal) {
        if (!current) continue;
        current.nominalStr = row.nominal;
        current.saldoStr = row.saldo;
      }
    }
    if (current) drafts.push(current);

    for (const d of drafts) {
      if (!d.dateStr || !d.nominalStr) continue; // baris yang gagal terbaca lengkap, jangan ditebak
      const amount = parseIdNumber(d.nominalStr);
      const saldo = parseIdNumber(d.saldoStr);
      const tanggal = d.timeStr ? `${d.dateStr} ${d.timeStr}` : d.dateStr;
      const transaksi = d.descParts.join(" ").replace(/\s+/g, " ").trim();
      transactions.push({
        tanggal,
        transaksi,
        debit: amount < 0 ? Math.abs(amount) : 0,
        kredit: amount > 0 ? amount : 0,
        saldo,
      });
    }
  }

  let verifikasi: MandiriParseResult["verifikasi"] = null;
  if (meta.saldoAwal !== undefined && meta.saldoAkhir !== undefined) {
    const totalDebit = transactions.reduce((s, t) => s + t.debit, 0);
    const totalKredit = transactions.reduce((s, t) => s + t.kredit, 0);
    const hitung = meta.saldoAwal + totalKredit - totalDebit;
    const selisih = Math.round((hitung - meta.saldoAkhir) * 100) / 100;
    verifikasi = {
      cocok: Math.abs(selisih) < 1,
      selisih,
      totalDebit,
      totalKredit,
    };
  }

  return { meta, transactions, verifikasi };
}
