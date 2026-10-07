import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buatTemplate } from "@/lib/produk";
import { hariIniWib } from "@/lib/alokasi";

/**
 * Template Excel berisi SKU yang ada di master. ADMIN/OWNER mendapat sheet DATA PRODUK
 * (dengan HPP saat ini, untuk mass edit) + STOK SO; role lain hanya STOK SO tanpa HPP.
 */
export async function GET() {
  const auth = await wajibLogin(undefined, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const denganHpp = bolehKelola(auth.user.role);
    const produk = await prisma.produk.findMany({
      orderBy: [{ brand: { nama: "asc" } }, { sku: "asc" }],
      include: { brand: true },
    });
    const buf = await buatTemplate(
      produk.map((p) => ({ sku: p.sku, brand: p.brand.nama, hpp: p.hpp.toNumber() })),
      denganHpp
    );
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="template_produk_so_${hariIniWib()}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
