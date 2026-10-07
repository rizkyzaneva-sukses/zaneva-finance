import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { buatExcelGagal, type BarisGagal } from "@/lib/produk";
import { hariIniWib } from "@/lib/alokasi";

/** Excel baris yang gagal diunggah (master atau SO), untuk diperbaiki lalu diunggah ulang. */
export async function POST(req: Request) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const jenis = body.jenis === "produk" ? "produk" : body.jenis === "so" ? "so" : null;
    if (!jenis || !Array.isArray(body.baris)) {
      return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
    }
    const baris: BarisGagal[] = body.baris.slice(0, 5000).map((b: Record<string, unknown>) => ({
      baris: Number(b.baris) || 0,
      sku: String(b.sku ?? ""),
      brand: b.brand === undefined ? undefined : String(b.brand),
      nilai: typeof b.nilai === "number" ? b.nilai : b.nilai == null ? null : String(b.nilai),
      alasan: String(b.alasan ?? ""),
    }));
    const buf = await buatExcelGagal(jenis, baris);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="gagal_${jenis}_${hariIniWib()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
