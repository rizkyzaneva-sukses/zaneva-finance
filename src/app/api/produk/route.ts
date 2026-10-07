import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

/** Master produk beserta HPP. HPP adalah data biaya, jadi hanya ADMIN/OWNER. */
export async function GET(req: Request) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const halaman = Math.max(1, Number(sp.get("halaman")) || 1);
    const perHalaman = Math.min(200, Math.max(10, Number(sp.get("perHalaman")) || 50));
    const where: Prisma.ProdukWhereInput = {};
    const q = (sp.get("q") ?? "").trim();
    if (q) where.sku = { contains: q, mode: "insensitive" };
    const brandId = sp.get("brandId");
    if (brandId) where.brandId = brandId;
    if (sp.get("hppNol") === "1") where.hpp = 0;

    const [produk, total, totalSemua, hppNol] = await Promise.all([
      prisma.produk.findMany({
        where,
        orderBy: { sku: "asc" },
        skip: (halaman - 1) * perHalaman,
        take: perHalaman,
        include: { brand: { select: { nama: true } } },
      }),
      prisma.produk.count({ where }),
      prisma.produk.count(),
      prisma.produk.count({ where: { hpp: 0 } }),
    ]);
    return NextResponse.json({ produk, total, halaman, perHalaman, totalSemua, hppNol });
  } catch (err) {
    return apiError(err);
  }
}
