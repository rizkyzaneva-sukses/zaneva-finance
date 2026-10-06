import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelolaPengguna } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const pengguna = await prisma.user.findMany({
      orderBy: [{ aktif: "desc" }, { nama: "asc" }],
      select: { id: true, nama: true, username: true, role: true, aktif: true, createdAt: true },
    });
    return NextResponse.json({ pengguna });
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
    if (!/^[a-z0-9._-]{3,}$/.test(username)) {
      return NextResponse.json(
        { error: "Username minimal 3 karakter, hanya huruf kecil, angka, titik, strip" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
    }
    if (!Object.values(Role).includes(role)) {
      return NextResponse.json({ error: "Role tidak valid" }, { status: 400 });
    }

    const sudahAda = await prisma.user.findUnique({ where: { username } });
    if (sudahAda) {
      return NextResponse.json({ error: `Username "${username}" sudah dipakai` }, { status: 409 });
    }

    const user = await prisma.user.create({
      data: { nama, username, passwordHash: await bcrypt.hash(password, 10), role },
      select: { id: true, nama: true, username: true, role: true, aktif: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    return apiError(err);
  }
}
