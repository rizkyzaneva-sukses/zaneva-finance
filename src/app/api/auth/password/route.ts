import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { unauthorized, wajibLogin } from "@/lib/api-helpers";
import { AksiAudit } from "@/generated/prisma/enums";

const gagal = new Map<string, { n: number; sampai: number }>();
const MAKS = 8;
const JENDELA = 15 * 60 * 1000;

function kenaLimit(userId: string) {
  const now = Date.now();
  const rec = gagal.get(userId);
  if (!rec || now > rec.sampai) {
    gagal.set(userId, { n: 1, sampai: now + JENDELA });
    return false;
  }
  rec.n += 1;
  return rec.n > MAKS;
}

export async function POST(req: Request) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  const panjang = Number(req.headers.get("content-length"));
  if (Number.isFinite(panjang) && panjang > 8192) {
    return NextResponse.json({ error: "Permintaan tidak valid" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const sekarang = typeof body.sekarang === "string" ? body.sekarang : "";
  const baru = typeof body.baru === "string" ? body.baru : "";
  const ulang = typeof body.ulang === "string" ? body.ulang : "";

  if (!sekarang || !baru || !ulang) {
    return NextResponse.json(
      { error: "Password sekarang, password baru, dan ulangi password wajib diisi" },
      { status: 400 }
    );
  }
  if (baru.length < 8 || baru.length > 128 || sekarang.length > 128) {
    return NextResponse.json({ error: "Password baru 8–128 karakter" }, { status: 400 });
  }
  if (baru !== ulang) {
    return NextResponse.json({ error: "Ulangi password tidak sama" }, { status: 400 });
  }
  if (baru === sekarang) {
    return NextResponse.json(
      { error: "Password baru harus berbeda dari password sekarang" },
      { status: 400 }
    );
  }

  if (kenaLimit(auth.user.id)) {
    return NextResponse.json(
      { error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." },
      { status: 429 }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, username: true, passwordHash: true, aktif: true },
  });
  if (!user || !user.aktif) return unauthorized();

  if (!(await bcrypt.compare(sekarang, user.passwordHash))) {
    return NextResponse.json({ error: "Password sekarang salah" }, { status: 400 });
  }

  const hasil = await prisma.$transaction(async (tx) => {
    const diubah = await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await bcrypt.hash(baru, 10),
        tokenSesi: { increment: 1 },
      },
      select: { tokenSesi: true },
    });
    await tx.auditLog.create({
      data: {
        userId: user.id,
        entitas: "User",
        entitasId: user.id,
        aksi: AksiAudit.UBAH,
        dataBaru: { username: user.username, password: "diganti sendiri" },
      },
    });
    return diubah;
  });

  // Sesi ini tetap masuk. Sesi lain dari akun yang sama batal.
  const session = await getSession();
  session.userId = user.id;
  session.tokenSesi = hasil.tokenSesi;
  await session.save();
  gagal.delete(auth.user.id);

  return NextResponse.json({ ok: true });
}
