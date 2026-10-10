import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelolaPengguna } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit, Role } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const pengguna = await prisma.user.findMany({
      orderBy: [{ aktif: "desc" }, { nama: "asc" }],
      select: {
        id: true,
        nama: true,
        username: true,
        role: true,
        aktif: true,
        createdAt: true,
        brandAkses: { select: { brand: { select: { id: true, nama: true } } } },
      },
    });
    return NextResponse.json({
      pengguna: pengguna.map(({ brandAkses, ...p }) => ({ ...p, brand: brandAkses.map((b) => b.brand) })),
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const nama = String(body.nama ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "") as Role;

    if (!nama) return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      return NextResponse.json(
        { error: "Username 3–32 karakter: huruf kecil, angka, titik, atau strip" },
        { status: 400 }
      );
    }
    if (password.length < 8 || password.length > 128) {
      return NextResponse.json({ error: "Password 8–128 karakter" }, { status: 400 });
    }
    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }

    // Penugasan brand: kosong = semua brand. OWNER selalu semua, jadi penugasannya diabaikan.
    const brandIds: string[] =
      role === Role.OWNER || !Array.isArray(body.brandIds) ? [] : [...new Set<string>(body.brandIds.map(String))];
    if (brandIds.length > 0) {
      const ada = await prisma.brand.count({ where: { id: { in: brandIds } } });
      if (ada !== brandIds.length) return NextResponse.json({ error: "Ada brand yang tidak valid" }, { status: 400 });
    }

    const sudahAda = await prisma.user.findUnique({ where: { username } });
    if (sudahAda) {
      return NextResponse.json({ error: `Username "${username}" sudah dipakai` }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: {
        nama,
        username,
        passwordHash: await bcrypt.hash(password, 10),
        role,
        brandAkses: { create: brandIds.map((brandId) => ({ brandId })) },
      },
      select: { id: true, nama: true, username: true, role: true, aktif: true },
    });
    if (brandIds.length > 0) {
      await prisma.auditLog.create({
        data: { userId: auth.user.id, entitas: "User", entitasId: user.id, aksi: AksiAudit.BUAT, dataBaru: { username, role, brandIds } },
      });
    }

    return NextResponse.json({ user });
  } catch (err) {
    return apiError(err);
  }
}
