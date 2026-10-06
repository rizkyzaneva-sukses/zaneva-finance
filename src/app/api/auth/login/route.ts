import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Rate limit sederhana per IP (cukup untuk app single-instance).
const percobaan = new Map<string, { n: number; sampai: number }>();
const MAKS = 5;
const JENDELA = 15 * 60 * 1000;

function kenaLimit(ip: string) {
  const now = Date.now();
  const rec = percobaan.get(ip);
  if (!rec || now > rec.sampai) {
    percobaan.set(ip, { n: 1, sampai: now + JENDELA });
    return false;
  }
  rec.n += 1;
  return rec.n > MAKS;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (kenaLimit(ip)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan login. Coba lagi 15 menit lagi." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Username dan password wajib diisi" }, { status: 400 });
  }

  let user;
  try {
    user = await prisma.user.findUnique({ where: { username } });
  } catch (err) {
    // Database tidak bisa dihubungi bukan salah user — jangan tampil seperti
    // password salah, karena itu bikin orang mencoba-coba password terus.
    console.error("[login] gagal akses database", err);
    return NextResponse.json(
      { error: "Server tidak bisa menghubungi database. Hubungi admin." },
      { status: 503 }
    );
  }

  // Pesan error sengaja sama untuk user tidak ada / password salah / akun nonaktif,
  // supaya tidak membocorkan username mana yang terdaftar.
  const gagal = NextResponse.json({ error: "Username atau password salah" }, { status: 401 });
  if (!user || !user.aktif) return gagal;
  if (!(await bcrypt.compare(password, user.passwordHash))) return gagal;

  const session = await getSession();
  session.userId = user.id;
  await session.save();

  percobaan.delete(ip);
  return NextResponse.json({ ok: true, nama: user.nama, role: user.role });
}
