import { NextResponse } from "next/server";
import { isAuthenticated, unauthorized, apiError } from "@/lib/api-helpers";
import { buildBniWorkbook } from "@/lib/excel";
import type { BniTransaction } from "@/lib/types";

export async function POST(req: Request) {
  if (!(await isAuthenticated())) return unauthorized();

  try {
    const { transactions } = (await req.json()) as { transactions: BniTransaction[] };
    if (!Array.isArray(transactions) || transactions.length === 0) {
      return NextResponse.json({ error: "Tidak ada data transaksi untuk diexport" }, { status: 400 });
    }

    const buf = await buildBniWorkbook(transactions);
    const tanggal = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Mutasi_BNI_${tanggal}.xlsx"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
