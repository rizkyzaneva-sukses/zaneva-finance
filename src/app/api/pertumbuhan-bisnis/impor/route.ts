import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehPertumbuhanBisnis } from "@/lib/auth";
import ExcelJS from "exceljs";
import { imporPertumbuhanDariWorkbook } from "@/lib/pertumbuhan-bisnis";

/**
 * POST /api/pertumbuhan-bisnis/impor
 * Mengunggah file Excel rekapan (.xlsx) dan menyimpannya ke database.
 * Akses: Hanya FINANCE (ADMIN) dan OWNER.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehPertumbuhanBisnis, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "File Excel wajib diunggah" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return NextResponse.json({ error: "Format file harus .xlsx" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const wb = new ExcelJS.Workbook();
    // @ts-expect-error ExcelJS buffer read
    await wb.xlsx.load(buffer);

    const hasil = await imporPertumbuhanDariWorkbook(wb, auth.user.id);

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${hasil.totalBarisDiimpor} data bulan untuk ${hasil.totalBrand} brand`,
      hasil,
    });
  } catch (err) {
    return apiError(err);
  }
}
