import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit } from "@/generated/prisma/enums";
import { kunciBrand } from "@/lib/produk";

type Params = { params: Promise<{ id: string }> };

/** Ganti nama brand. Produk, rekening, dan SO lama ikut memakai nama baru (semuanya merujuk ke id). */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const lama = await prisma.brand.findUnique({ where: { id } });
    if (!lama) return NextResponse.json({ error: "Brand tidak ditemukan" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const nama = String(body.nama ?? "").trim().replace(/\s+/g, " ");
    if (!nama) return NextResponse.json({ error: "Nama brand wajib diisi" }, { status: 400 });
    if (nama.length > 60) return NextResponse.json({ error: "Nama brand maksimal 60 karakter" }, { status: 400 });
    const kunci = kunciBrand(nama);
    if (!kunci) return NextResponse.json({ error: "Nama brand harus memuat huruf atau angka" }, { status: 400 });

    const bentrok = await prisma.brand.findFirst({
      where: { id: { not: id }, OR: [{ kunci }, { nama }] },
    });
    if (bentrok) {
      return NextResponse.json({ error: `Brand "${bentrok.nama}" sudah ada` }, { status: 409 });
    }

    const brand = await prisma.brand.update({ where: { id }, data: { nama, kunci } });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        entitas: "Brand",
        entitasId: id,
        aksi: AksiAudit.UBAH,
        dataLama: { nama: lama.nama },
        dataBaru: { nama },
      },
    });
    return NextResponse.json({ brand });
  } catch (err) {
    return apiError(err);
  }
}

/** Hapus brand yang belum dipakai apa pun. Yang sudah dipakai ditolak, bukan dilepas diam-diam. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { _count: { select: { produk: true, rekening: true, penugasan: true, soItem: true } } },
    });
    if (!brand) return NextResponse.json({ error: "Brand tidak ditemukan" }, { status: 404 });

    const c = brand._count;
    if (c.produk + c.rekening + c.penugasan + c.soItem > 0) {
      return NextResponse.json(
        {
          error: `Brand "${brand.nama}" masih dipakai: ${c.produk} produk, ${c.rekening} rekening, ${c.penugasan} pengguna, ${c.soItem} baris SO. Lepaskan dulu, atau cukup ganti namanya.`,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.brand.delete({ where: { id } }),
      prisma.auditLog.create({
        data: { userId: auth.user.id, entitas: "Brand", entitasId: id, aksi: AksiAudit.HAPUS, dataLama: { nama: brand.nama } },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
