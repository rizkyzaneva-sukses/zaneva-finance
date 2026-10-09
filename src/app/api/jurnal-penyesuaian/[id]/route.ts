import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehJurnalPenyesuaian } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bacaBaris, hapusJurnal, tanggalValid, ubahJurnal } from "@/lib/jurnal-penyesuaian";

function bolehBrand(brandIds: string[] | null, brandId: string) {
  return brandIds === null || brandIds.includes(brandId);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await wajibLogin(bolehJurnalPenyesuaian);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await ctx.params;
    const ada = await prisma.jurnalPenyesuaian.findUnique({
      where: { id },
      select: { brandId: true },
    });
    if (!ada) return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
    if (!bolehBrand(auth.user.brandIds, ada.brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const brandId = String(body.brandId ?? "");
    const tanggal = String(body.tanggal ?? "");
    const keterangan = String(body.keterangan ?? "").trim().replace(/\s+/g, " ");
    const dibalik = Boolean(body.dibalik);
    if (!brandId) return NextResponse.json({ error: "Pilih brand dulu" }, { status: 400 });
    if (!bolehBrand(auth.user.brandIds, brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }
    if (!tanggalValid(tanggal)) return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
    if (!keterangan) return NextResponse.json({ error: "Keterangan wajib diisi" }, { status: 400 });
    if (keterangan.length > 300) {
      return NextResponse.json({ error: "Keterangan maksimal 300 karakter" }, { status: 400 });
    }
    const baris = bacaBaris(body.baris);
    if (!baris.ok) return NextResponse.json({ error: baris.error }, { status: 400 });

    const hasil = await ubahJurnal(id, {
      brandId,
      tanggal,
      keterangan,
      dibalik,
      baris: baris.baris,
      userId: auth.user.id,
    });
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: hasil.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await wajibLogin(bolehJurnalPenyesuaian);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await ctx.params;
    const ada = await prisma.jurnalPenyesuaian.findUnique({
      where: { id },
      select: { brandId: true },
    });
    if (!ada) return NextResponse.json({ error: "Jurnal tidak ditemukan" }, { status: 404 });
    if (!bolehBrand(auth.user.brandIds, ada.brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }
    const hasil = await hapusJurnal(id, auth.user.id);
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: hasil.status });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
