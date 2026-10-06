import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Rate limit sederhana per IP (cukup untuk app single-instance, single-user).
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

  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) {
    return NextResponse.json(
      { error: "APP_PASSWORD belum diset di server" },
      { status: 503 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: undefined }));
  if (!password || typeof password !== "string") {
    return NextResponse.json({ error: "Password wajib diisi" }, { status: 400 });
  }

  if (password !== appPassword) {
    return NextResponse.json({ error: "Password salah" }, { status: 401 });
  }

  const session = await getSession();
  session.isLoggedIn = true;
  await session.save();

  percobaan.delete(ip);
  return NextResponse.json({ ok: true });
}
