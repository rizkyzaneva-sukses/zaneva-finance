import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelolaPengguna } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const lama = await prisma.user.findUnique({ where: { id } });
    if (!lama) return NextResponse.json({ error: "Pengguna tidak ditemukan" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Prisma.UserUpdateInput = {};

    if (typeof body.nama === "string" && body.nama.trim()) data.nama = body.nama.trim();
    if (Object.values(Role).includes(body.role)) data.role = body.role;
    if (typeof body.aktif === "boolean") data.aktif = body.aktif;
    if (typeof body.password === "string" && body.password) {
      if (body.password.length < 8) {
        return NextResponse.json({ error: "Password minimal 8 karakter" }, { status: 400 });
      }
      data.passwordHash = await bcrypt.hash(body.password, 10);
    }

    // Jangan sampai OWNER terakhir kehilangan aksesnya dan app jadi tak terkelola.
    const turunDariOwner = lama.role === Role.OWNER && data.role && data.role !== Role.OWNER;
    const dinonaktifkan = lama.role === Role.OWNER && data.aktif === false;
    if (turunDariOwner || dinonaktifkan) {
      const ownerAktif = await prisma.user.count({ where: { role: Role.OWNER, aktif: true } });
      if (ownerAktif <= 1) {
        return NextResponse.json(
          { error: "Ini satu-satunya OWNER yang aktif. Angkat OWNER lain dulu sebelum mengubah yang ini." },
          { status: 409 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, nama: true, username: true, role: true, aktif: true },
    });

    return NextResponse.json({ user });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    if (id === auth.user.id) {
      return NextResponse.json({ error: "Tidak bisa menghapus akun sendiri" }, { status: 409 });
    }

    // Sekecil apa pun jejaknya, user yang pernah beraktivitas tidak boleh dihapus:
    // menghapusnya memutus atribusi di Log Aktivitas dan di transaksi, padahal
    // itulah gunanya log — menjawab "siapa yang mengubah ini".
    const [dibuat, diubah, diacc, aktivitas] = await Promise.all([
      prisma.transaksi.count({ where: { createdById: id } }),
      prisma.transaksi.count({ where: { updatedById: id } }),
      prisma.transaksi.count({ where: { accOlehId: id } }),
      prisma.auditLog.count({ where: { userId: id } }),
    ]);
    if (dibuat + diubah + diacc + aktivitas > 0) {
      return NextResponse.json(
        {
          error: `Pengguna ini punya jejak aktivitas (${aktivitas} entri log, ${dibuat} transaksi dibuat), jadi tidak bisa dihapus. Nonaktifkan saja supaya jejaknya tetap utuh.`,
        },
        { status: 409 }
      );
    }

    await prisma.user.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
