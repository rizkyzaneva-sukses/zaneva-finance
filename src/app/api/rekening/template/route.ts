import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { buatTemplateRekening, buatExcelGagalRekening, type GagalRekening } from "@/lib/rekening-impor";
import { hariIniWib } from "@/lib/alokasi";

/** Unduh template Excel import rekening (header + 2 contoh baris). */
export async function GET() {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;
  try {
    const buf = await buatTemplateRekening();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_rekening_${hariIniWib()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

/** Unduh Excel berisi baris gagal (dari pratinjau) supaya bisa diperbaiki lalu diunggah ulang. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json().catch(() => ({}));
    const baris: GagalRekening[] = Array.isArray(body.baris) ? body.baris : [];
    const buf = await buatExcelGagalRekening(baris);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="rekening_gagal_${hariIniWib()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
