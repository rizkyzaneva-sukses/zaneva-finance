import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

// Rate limit di memori proses (cukup untuk satu instance).
// Kunci username tidak bisa dipalsukan lewat header. Kunci IP hanya pelengkap.
const percobaan = new Map<string, { n: number; sampai: number }>();
const MAKS_IP = 20;
const MAKS_USER = 8;
const JENDELA = 15 * 60 * 1000;
// Hash bcrypt tetap supaya user yang tidak ada tidak lebih cepat dibalas daripada password salah.
const HASH_KOSONG = "$2b$10$OxyCcCTSiJV6jGAflynDqO588v.p6nS8Msaxbv88.gpMRMRFEVlgW";

function kenaLimit(kunci: string, maks: number) {
  const now = Date.now();
  const rec = percobaan.get(kunci);
  if (!rec || now > rec.sampai) {
    percobaan.set(kunci, { n: 1, sampai: now + JENDELA });
    return false;
  }
  rec.n += 1;
  return rec.n > maks;
}

function lupa(kunci: string) {
  percobaan.delete(kunci);
}

/** Jangan biarkan ribuan username palsu menumpuk di memori sampai proses di-restart. */
function sapuPercobaan() {
  if (percobaan.size < 2000) return;
  const now = Date.now();
  for (const [kunci, rec] of percobaan) {
    if (now > rec.sampai) percobaan.delete(kunci);
  }
  if (percobaan.size <= 10000) return;
  let buang = percobaan.size - 5000;
  for (const kunci of percobaan.keys()) {
    percobaan.delete(kunci);
    if (--buang <= 0) break;
  }
}

/** IP yang dilihat proxy, bukan nilai yang dikirim browser di depan header. */
function ipKlien(req: Request) {
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 64);
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const bagian = forwarded
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const terakhir = bagian[bagian.length - 1];
    if (terakhir) return terakhir.slice(0, 64);
  }
  return "unknown";
}

export async function POST(req: Request) {
  const panjang = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjang) && panjang > 8192) {
    return NextResponse.json({ error: "Permintaan login tidak valid" }, { status: 400 });
  }

  const ip = ipKlien(req);
  sapuPercobaan();
  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim().slice(0, 64) : "";
  const password = typeof body.password === "string" ? body.password : "";
  const kunciUser = `user:${username.toLowerCase()}`;

  if (kenaLimit(`ip:${ip}`, MAKS_IP) || (username && kenaLimit(kunciUser, MAKS_USER))) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan login. Coba lagi 15 menit lagi." },
      { status: 429 }
    );
  }

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
  // Password sangat panjang hanya membebani CPU bcrypt, bukan kredensial yang sah.
  if (!user || !user.aktif || password.length > 128) {
    await bcrypt.compare(password.slice(0, 72), HASH_KOSONG);
    return gagal;
  }
  if (!(await bcrypt.compare(password, user.passwordHash))) return gagal;

  const session = await getSession();
  session.userId = user.id;
  session.tokenSesi = user.tokenSesi;
  await session.save();

  lupa(`ip:${ip}`);
  lupa(kunciUser);
  return NextResponse.json({ ok: true, nama: user.nama, role: user.role });
}
