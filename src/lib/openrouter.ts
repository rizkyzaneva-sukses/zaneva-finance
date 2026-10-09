import { parseTanggalIndo, tanggalKeIso } from "@/lib/utils";
import type { BarisParsing } from "@/lib/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Prompt OCR generik — sengaja tidak menyebut bank tertentu supaya satu prompt
 * melayani BCA, Mandiri, BRI, BNI, dan rekening lain tanpa perlu cabang kode.
 */
const PROMPT_MUTASI = `Kamu membaca screenshot/foto mutasi rekening bank Indonesia (mobile banking, internet banking, atau cetakan rekening koran).
Bank-nya bisa BCA, Mandiri, BRI, BNI, atau bank lain — tata letaknya berbeda-beda, tapi tugasmu sama.

Ekstrak SEMUA baris transaksi yang terlihat menjadi JSON array, tanpa teks lain di luar JSON.
Setiap elemen array wajib punya field persis seperti ini:
{
  "tanggal": "1 November 2023",   // tanggal transaksi persis seperti tertulis di gambar
  "keterangan": "TRSF E-BANKING CR PT MIDTRANS",  // uraian transaksi selengkap mungkin, jangan dipotong
  "arah": "masuk",                // "masuk" kalau uang bertambah, "keluar" kalau uang berkurang
  "nominal": 218000.00,           // angka murni tanpa Rp dan tanpa pemisah ribuan
  "saldo": 10218000.00,           // saldo setelah transaksi ini kalau ditampilkan; null kalau tidak ada
  "yakin": true                   // false kalau tulisan buram/terpotong/kamu ragu membacanya
}

Cara menentukan "arah":
- Tanda "+" , warna hijau, label "CR"/"Cr."/"Kredit" => "masuk"
- Tanda "-" , warna merah, label "DB"/"Db."/"Debit" => "keluar"
- Kalau ada dua kolom terpisah (Debit dan Kredit), kolom mana yang terisi menentukan arahnya.

Aturan penting:
- Urutkan sesuai urutan baris di gambar (atas ke bawah).
- Kalau tampilannya berupa grup tanggal (header tanggal diikuti beberapa kartu transaksi), pakai tanggal grup di atasnya untuk setiap kartu di bawahnya.
- Beberapa tampilan mobile banking TIDAK menampilkan saldo berjalan. Kalau begitu isi "saldo": null. Jangan pernah menebak saldo.
- JANGAN mengarang baris yang tidak benar-benar terlihat.
- Kalau ada bagian buram/terpotong, tetap masukkan barisnya dengan field yang bisa dibaca, lalu set "yakin": false.
- Kalau tidak ada transaksi sama sekali di gambar, balas array kosong [].
- Balas HANYA JSON array yang valid, tanpa markdown code fence, tanpa penjelasan.`;

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

function extractJsonArray(text: string): unknown[] {
  const cleaned = text.trim().replace(/^```json?/i, "").replace(/```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // lanjut ke fallback
  }
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) {
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed)) return parsed;
  }
  throw new Error("Respons AI tidak berisi JSON array yang valid");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = toNumber(value);
  return n === 0 && value !== 0 && value !== "0" ? null : n;
}

async function panggilOpenRouter(
  messages: unknown[],
  { jsonMode = false }: { jsonMode?: boolean } = {}
): Promise<string> {
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
      "X-Title": "Zaneva Finance",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      messages,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenRouter error (${res.status}): ${body.slice(0, 300)}`);
  }

  const json = (await res.json()) as OpenRouterResponse;
  if (json.error) throw new Error(`OpenRouter error: ${json.error.message ?? "unknown"}`);

  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter tidak mengembalikan konten");
  return content;
}

/** Tahap 1 — OCR satu gambar mutasi jadi baris transaksi mentah. */
export async function parseGambarMutasi(
  dataUrl: string,
  sumberFile: string
): Promise<BarisParsing[]> {
  const content = await panggilOpenRouter([
    {
      role: "user",
      content: [
        { type: "text", text: PROMPT_MUTASI },
        { type: "image_url", image_url: { url: dataUrl } },
      ],
    },
  ]);

  return extractJsonArray(content).map((row): BarisParsing => {
    const r = row as Record<string, unknown>;
    const nominal = toNumber(r.nominal);
    const masuk = String(r.arah ?? "").trim().toLowerCase() === "masuk";
    const tanggalTeks = String(r.tanggal ?? "").trim();
    const tanggal = parseTanggalIndo(tanggalTeks);

    return {
      tanggalTeks,
      tanggalIso: tanggal ? tanggalKeIso(tanggal) : null,
      keterangan: String(r.keterangan ?? "").trim(),
      uangMasuk: masuk ? nominal : 0,
      uangKeluar: masuk ? 0 : nominal,
      saldoBank: toNumberOrNull(r.saldo),
      // tanggal tak terbaca = baris tidak bisa dipercaya penuh
      yakin: r.yakin !== false && tanggal !== null,
      sumberFile,
    };
  });
}

/** Buang baris yang identik — lazim muncul dari screenshot yang overlap karena scroll. */
export function dedupeHasilParsing(rows: BarisParsing[]): BarisParsing[] {
  const seen = new Set<string>();
  const hasil: BarisParsing[] = [];
  for (const r of rows) {
    const key = `${r.tanggalTeks}|${r.keterangan}|${r.uangMasuk}|${r.uangKeluar}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hasil.push(r);
  }
  return hasil;
}

export interface OpsiKodeAkun {
  id: string;
  kode: string;
  nama: string;
}

/**
 * Tahap 2 — sarankan kode akun untuk tiap keterangan transaksi.
 *
 * Dipisah dari OCR supaya: akurasi tiap tahap tidak saling mengganggu, bisa
 * dihitung ulang tanpa OCR ulang kalau chart of accounts berubah, dan jauh
 * lebih murah (teks saja, tanpa gambar).
 */
export async function sarankanKodeAkun(
  keterangan: { index: number; teks: string; arah: "masuk" | "keluar" }[],
  daftarKode: OpsiKodeAkun[],
  contoh: { arah: "masuk" | "keluar"; kunci: string; kode: string }[] = []
): Promise<Map<number, string>> {
  if (keterangan.length === 0) return new Map();

  const daftar = daftarKode.map((k) => `${k.kode} = ${k.nama}`).join("\n");
  const transaksi = keterangan
    .map((k) => `${k.index}. [${k.arah}] ${k.teks}`)
    .join("\n");
  const blokContoh =
    contoh.length === 0
      ? ""
      : `\nCONTOH YANG SUDAH DIKONFIRMASI TIM (kalau polanya mirip, ikuti kode ini, jangan menebak lain):\n${contoh
          .map((c) => `- [${c.arah}] ${c.kunci} → ${c.kode}`)
          .join("\n")}\n`;

  const prompt = `Kamu membantu tim keuangan mengklasifikasikan transaksi bank ke kode akun pembukuan.

DAFTAR KODE AKUN YANG TERSEDIA:
${daftar}
${blokContoh}
DAFTAR TRANSAKSI (format: nomor. [arah uang] keterangan):
${transaksi}

Tugas: tentukan kode akun paling tepat untuk setiap transaksi.

Aturan tetap tim:
- Uang masuk marketplace (Shopee, Lazada, Tokopedia, TikTok, Midtrans) pakai kode penjualannya masing-masing, bukan 400.
- Uang masuk JNT / J&T VIP = 409, SAP = 408, Mengantar = 410, kalau kode itu ada di daftar.
- Pencairan QR / QRIS jangan diisi 400.
- Uang masuk transfer orang (bukan yang di atas) biasanya 400, tapi baris itu sering sudah ditangani di luar prompt ini.
- Contoh yang dikonfirmasi tim lebih kuat dari tebakanmu.

Aturan jawaban:
- Balas HANYA JSON object dengan bentuk {"hasil":[{"index":0,"kode":"402"}, ...]}
- "kode" HARUS salah satu kode yang ada di daftar di atas, disalin persis.
- Kalau kamu tidak yakin, atau beberapa kode sama-sama masuk akal dan tidak ada petunjuk pembeda di keterangannya, isi "kode": null. JANGAN menebak.
- Perhatikan arah uang: transaksi "masuk" biasanya Pendapatan/Penjualan/Pinjaman diterima; transaksi "keluar" biasanya Beban/Pembelian.
- Beberapa kode punya nama yang sama persis satu sama lain. Kalau keterangan transaksi tidak memberi petunjuk untuk memilih di antara mereka, isi null.
- Sertakan SEMUA nomor transaksi di jawabanmu.`;

  const content = await panggilOpenRouter(
    [{ role: "user", content: prompt }],
    { jsonMode: true }
  );

  let parsed: { hasil?: { index?: unknown; kode?: unknown }[] };
  try {
    parsed = JSON.parse(content.trim().replace(/^```json?/i, "").replace(/```$/, "").trim());
  } catch {
    throw new Error("Respons AI klasifikasi bukan JSON yang valid");
  }

  const kodeValid = new Set(daftarKode.map((k) => k.kode));
  const hasil = new Map<number, string>();
  for (const item of parsed.hasil ?? []) {
    const index = Number(item.index);
    const kode = item.kode == null ? null : String(item.kode).trim();
    // Kode karangan AI yang tidak ada di master sengaja dibuang, bukan dipaksa masuk.
    if (Number.isInteger(index) && kode && kodeValid.has(kode)) {
      hasil.set(index, kode);
    }
  }
  return hasil;
}
