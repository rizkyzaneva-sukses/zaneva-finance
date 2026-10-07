import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit } from "@/generated/prisma/enums";
import { kunciBrand } from "@/lib/produk";

/** Daftar brand. Pengguna yang dibatasi hanya melihat brand yang ditugaskan kepadanya. */
export async function GET() {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;
  try {
    const brand = await prisma.brand.findMany({
      where: auth.user.brandIds ? { id: { in: auth.user.brandIds } } : undefined,
      orderBy: { nama: "asc" },
      include: { _count: { select: { produk: true, rekening: true, penugasan: true } } },
    });
    return NextResponse.json({ brand });
  } catch (err) {
    return apiError(err);
  }
}

/** Tambah brand. Brand juga otomatis dibuat saat unggah master produk, tapi di sini bisa dibuat lebih dulu. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const nama = String(body.nama ?? "").trim().replace(/\s+/g, " ");
    if (!nama) return NextResponse.json({ error: "Nama brand wajib diisi" }, { status: 400 });
    if (nama.length > 60) return NextResponse.json({ error: "Nama brand maksimal 60 karakter" }, { status: 400 });
    const kunci = kunciBrand(nama);
    if (!kunci) return NextResponse.json({ error: "Nama brand harus memuat huruf atau angka" }, { status: 400 });

    const sama = await prisma.brand.findFirst({ where: { OR: [{ kunci }, { nama }] } });
    if (sama) {
      return NextResponse.json(
        { error: `Brand "${sama.nama}" sudah ada (penulisan "${nama}" dianggap sama)` },
        { status: 409 }
      );
    }

    const brand = await prisma.brand.create({ data: { nama, kunci } });
    await prisma.auditLog.create({
      data: { userId: auth.user.id, entitas: "Brand", entitasId: brand.id, aksi: AksiAudit.BUAT, dataBaru: { nama } },
    });
    return NextResponse.json({ brand });
  } catch (err) {
    return apiError(err);
  }
}
