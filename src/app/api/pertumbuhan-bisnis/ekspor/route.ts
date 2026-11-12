import { NextResponse } from "next/server";
import { wajibLogin } from "@/lib/api-helpers";
import { bolehPertumbuhanBisnis } from "@/lib/auth";
import { buatExcelPertumbuhanBisnis } from "@/lib/pertumbuhan-bisnis";

/**
 * GET /api/pertumbuhan-bisnis/ekspor
 * Mengunduh seluruh rekapan pertumbuhan bisnis dalam format Excel (.xlsx).
 * Akses: Hanya FINANCE (ADMIN) dan OWNER.
 */
export async function GET() {
  const auth = await wajibLogin(bolehPertumbuhanBisnis, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const wb = await buatExcelPertumbuhanBisnis();
    const buffer = await wb.xlsx.writeBuffer();

    const namaFile = `Rekap_Pertumbuhan_Bisnis_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${namaFile}"`,
      },
    });
  } catch (err) {
    console.error("[ekspor pertumbuhan]", err);
    return NextResponse.json({ error: "Gagal membuat file Excel" }, { status: 500 });
  }
}
