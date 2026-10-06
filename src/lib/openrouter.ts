import type { BniTransaction, MandiriTransaction } from "@/lib/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const BNI_PROMPT = `Kamu membaca screenshot mutasi rekening BNI (mobile/internet banking).
Ekstrak SEMUA baris transaksi yang terlihat di gambar ini menjadi JSON array, tanpa teks lain di luar JSON.

Setiap elemen array wajib punya field persis seperti ini:
{
  "tanggal": "1 October 2026",       // tanggal transaksi persis seperti tertulis di gambar
  "uraian": "PT MIDTRANS",            // uraian/nama transaksi lengkap, jangan dipotong
  "type": "Db",                       // "Db" kalau debit/uang keluar, "Cr" kalau kredit/uang masuk
  "jumlah": 399000.00,                 // nominal transaksi, angka murni tanpa simbol/pemisah ribuan
  "saldo": 55509528.00,                // saldo setelah transaksi ini, angka murni
  "yakin": true                        // false kalau tulisan buram/terpotong/kamu tidak yakin membacanya
}

Aturan penting:
- Urutkan sesuai urutan baris di gambar (atas ke bawah).
- Jangan mengarang baris yang tidak benar-benar terlihat.
- Kalau ada bagian yang buram/tidak terbaca jelas, tetap masukkan baris itu dengan field yang bisa dibaca, dan set "yakin": false.
- Kalau sama sekali tidak ada transaksi terlihat di gambar, balas array kosong [].
- Balas HANYA dengan JSON array yang valid, tanpa markdown code fence, tanpa penjelasan.`;

const MANDIRI_SS_PROMPT = `Kamu membaca screenshot daftar transaksi/mutasi dari aplikasi mobile banking Mandiri (Livin').
Tampilannya berupa grup tanggal (misal "02 Okt 2026") diikuti beberapa kartu transaksi di bawahnya,
sampai grup tanggal berikutnya. Tiap kartu berisi judul transaksi (misal "Transfer Rupiah"), nominal
dengan tanda warna di kanan (hijau/"+" = uang masuk, merah/"-" = uang keluar), dan 1-3 baris keterangan
di bawah judul (channel transfer, nama bank, nama pengirim/penerima, nomor rekening).

Ekstrak SEMUA kartu transaksi yang terlihat menjadi JSON array, tanpa teks lain di luar JSON.
Setiap elemen array wajib punya field persis seperti ini:
{
  "tanggal": "02 Okt 2026",            // ambil dari header grup tanggal yang menaungi kartu ini, apa adanya seperti tertulis
  "transaksi": "Transfer Rupiah - Transfer BI Fast - dari BPD JATIM - ZUMAROH 0372182768", // judul + semua baris keterangan, digabung dengan " - "
  "arah": "masuk",                      // "masuk" kalau nominal hijau/ada tanda "+", "keluar" kalau merah/tanda "-"
  "nominal": 193000.00,                 // angka murni tanpa simbol Rp/pemisah ribuan
  "yakin": true                         // false kalau ada bagian buram/terpotong/tidak yakin
}

Aturan penting:
- Saldo berjalan TIDAK ditampilkan di layar ini, jangan diisi/ditebak sama sekali.
- Urutkan sesuai urutan tampil di gambar (atas ke bawah).
- Jangan mengarang kartu yang tidak benar-benar terlihat.
- Kalau ada bagian yang buram/terpotong, tetap masukkan dengan field yang bisa dibaca, set "yakin": false.
- Kalau sama sekali tidak ada transaksi terlihat, balas array kosong [].
- Balas HANYA dengan JSON array yang valid, tanpa markdown code fence, tanpa penjelasan.`;

interface OpenRouterChoice {
  message?: { content?: string };
}
interface OpenRouterResponse {
  choices?: OpenRouterChoice[];
  error?: { message?: string };
}

function extractJsonArray(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```json?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // lanjut ke fallback di bawah
  }
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) return parsed;
  }
  throw new Error("Respons AI tidak berisi JSON array yang valid");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function callOpenRouterVision(prompt: string, dataUrl: string): Promise<unknown[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY belum diisi di environment variable");
  }
  const model = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "X-Title": "Zaneva Mutasi",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as OpenRouterResponse;
  if (json.error) {
    throw new Error(`OpenRouter error: ${json.error.message ?? "unknown"}`);
  }
  const content = json.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenRouter tidak mengembalikan konten");
  }

  return extractJsonArray(content);
}

export async function parseBniImage(
  dataUrl: string,
  sumberFile: string
): Promise<BniTransaction[]> {
  const rawRows = await callOpenRouterVision(BNI_PROMPT, dataUrl);

  return rawRows.map((row): BniTransaction => {
    const r = row as Record<string, unknown>;
    return {
      tanggal: String(r.tanggal ?? "").trim(),
      uraian: String(r.uraian ?? "").trim(),
      type: String(r.type ?? "").trim(),
      jumlah: toNumber(r.jumlah),
      saldo: toNumber(r.saldo),
      yakin: r.yakin !== false,
      sumber: sumberFile,
    };
  });
}

/** Buang baris yang persis identik (biasa muncul dari screenshot yang overlap karena scroll) */
export function dedupeBniTransactions(rows: BniTransaction[]): BniTransaction[] {
  const seen = new Set<string>();
  const result: BniTransaction[] = [];
  for (const r of rows) {
    const key = `${r.tanggal}|${r.uraian}|${r.type}|${r.jumlah}|${r.saldo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(r);
  }
  return result;
}

export async function parseMandiriImage(
  dataUrl: string,
  sumberFile: string
): Promise<MandiriTransaction[]> {
  const rawRows = await callOpenRouterVision(MANDIRI_SS_PROMPT, dataUrl);

  return rawRows.map((row): MandiriTransaction => {
    const r = row as Record<string, unknown>;
    const nominal = toNumber(r.nominal);
    const masuk = String(r.arah ?? "").trim().toLowerCase() === "masuk";
    return {
      tanggal: String(r.tanggal ?? "").trim(),
      transaksi: String(r.transaksi ?? "").trim(),
      debit: masuk ? 0 : nominal,
      kredit: masuk ? nominal : 0,
      saldo: null,
      yakin: r.yakin !== false,
      sumber: sumberFile,
    };
  });
}

/** Buang baris yang persis identik (biasa muncul dari screenshot yang overlap karena scroll) */
export function dedupeMandiriTransactions(rows: MandiriTransaction[]): MandiriTransaction[] {
  const seen = new Set<string>();
  const result: MandiriTransaction[] = [];
  for (const r of rows) {
    const key = `${r.tanggal}|${r.transaksi}|${r.debit}|${r.kredit}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(r);
  }
  return result;
}
