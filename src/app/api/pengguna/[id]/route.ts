import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelolaPengguna } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, Role } from "@/generated/prisma/enums";

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

    // Penugasan brand: dikirim sebagai daftar lengkap (mengganti yang lama). OWNER selalu semua brand.
    const roleAkhir = (data.role as Role | undefined) ?? lama.role;
    let brandBaru: string[] | null = null;
    if (roleAkhir === Role.OWNER) brandBaru = [];
    else if (Array.isArray(body.brandIds)) brandBaru = [...new Set<string>(body.brandIds.map(String))];
    if (brandBaru && brandBaru.length > 0) {
      const ada = await prisma.brand.count({ where: { id: { in: brandBaru } } });
      if (ada !== brandBaru.length) return NextResponse.json({ error: "Ada brand yang tidak valid" }, { status: 400 });
    }
    const brandLama = (await prisma.userBrand.findMany({ where: { userId: id }, select: { brandId: true } })).map(
      (b) => b.brandId
    );

    const user = await prisma.$transaction(async (tx) => {
      const hasil = await tx.user.update({
        where: { id },
        data,
        select: { id: true, nama: true, username: true, role: true, aktif: true },
      });
      if (brandBaru) {
        await tx.userBrand.deleteMany({ where: { userId: id } });
        if (brandBaru.length > 0) {
          await tx.userBrand.createMany({ data: brandBaru.map((brandId) => ({ userId: id, brandId })) });
        }
        const sama = brandLama.length === brandBaru.length && brandLama.every((b) => brandBaru!.includes(b));
        if (!sama) {
          await tx.auditLog.create({
            data: {
              userId: auth.user.id,
              entitas: "User",
              entitasId: id,
              aksi: AksiAudit.UBAH,
              dataLama: { username: lama.username, brandIds: brandLama },
              dataBaru: { username: lama.username, brandIds: brandBaru },
            },
          });
        }
      }
      return hasil;
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
