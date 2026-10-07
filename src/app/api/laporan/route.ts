import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan } from "@/lib/auth";
import { hitungLaporan } from "@/lib/laporan";

const FORMAT_TANGGAL = /^\d{4}-\d{2}-\d{2}$/;

/** Laba Rugi, Neraca, Arus Kas, dan Perubahan Modal sekaligus — dihitung dari entri yang sama. */
export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLaporan);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const dari = sp.get("dari") ?? "";
    const sampai = sp.get("sampai") ?? "";

    if (!FORMAT_TANGGAL.test(dari) || !FORMAT_TANGGAL.test(sampai)) {
      return NextResponse.json({ error: "Tanggal dari dan sampai wajib diisi" }, { status: 400 });
    }
    if (dari > sampai) {
      return NextResponse.json(
        { error: "Tanggal 'dari' tidak boleh setelah tanggal 'sampai'" },
        { status: 400 }
      );
    }

    const laporan = await hitungLaporan({
      dari,
      sampai,
      rekeningId: sp.get("rekeningId") || null,
      brandId: sp.get("brandId") || null,
    });
    return NextResponse.json(laporan);
  } catch (err) {
    return apiError(err);
  }
}
