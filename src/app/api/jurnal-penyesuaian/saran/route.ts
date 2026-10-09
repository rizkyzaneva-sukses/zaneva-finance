import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan } from "@/lib/auth";
import { saranAkun, tanggalValid } from "@/lib/jurnal-penyesuaian";

export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLaporan);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const brandId = url.searchParams.get("brandId") ?? "";
    const kodeAkunId = url.searchParams.get("kodeAkunId") ?? "";
    const dari = url.searchParams.get("dari") ?? "";
    const sampai = url.searchParams.get("sampai") ?? "";
    if (!brandId || !kodeAkunId) {
      return NextResponse.json({ error: "Brand dan kode akun wajib diisi" }, { status: 400 });
    }
    if (auth.user.brandIds && !auth.user.brandIds.includes(brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }
    if (!tanggalValid(dari) || !tanggalValid(sampai) || dari > sampai) {
      return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
    }
    const saran = await saranAkun({ brandId, kodeAkunId, dari, sampai });
    if (!saran) return NextResponse.json({ error: "Kode akun tidak ditemukan" }, { status: 404 });
    return NextResponse.json(saran);
  } catch (err) {
    return apiError(err);
  }
}
