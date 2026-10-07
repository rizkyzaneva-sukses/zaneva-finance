import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

/** Daftar brand, untuk filter laporan dan pilihan brand di Rekening. */
export async function GET() {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;
  try {
    const brand = await prisma.brand.findMany({
      orderBy: { nama: "asc" },
      include: { _count: { select: { produk: true, rekening: true } } },
    });
    return NextResponse.json({ brand });
  } catch (err) {
    return apiError(err);
  }
}
