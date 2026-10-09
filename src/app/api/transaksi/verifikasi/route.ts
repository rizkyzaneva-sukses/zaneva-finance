import { NextResponse } from "next/server";
import { AksiAudit } from "@/generated/prisma/enums";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehVerifikasiPenjualan } from "@/lib/auth";
import { bolehRekening } from "@/lib/akses";
import { prisma } from "@/lib/prisma";
import { KODE_PENJUALAN } from "@/lib/mutasi-pola";

/** Tandai atau kosongkan verifikasi penjualan kode 400. Tidak mengubah ACC. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehVerifikasiPenjualan);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map((id: unknown) => String(id)).filter(Boolean) : [];
    const verified = body.verified === true;
    if (ids.length === 0) {
      return NextResponse.json({ error: "Tidak ada transaksi yang dipilih" }, { status: 400 });
    }

    const daftar = await prisma.transaksi.findMany({
      where: { id: { in: ids } },
      include: {
        kodeAkun: { select: { kode: true } },
        rincian: { select: { kodeAkun: { select: { kode: true } } } },
      },
    });

    const boleh = daftar.filter((t) => {
      if (!bolehRekening(auth.user, t.rekeningId)) return false;
      return (
        t.kodeAkun?.kode === KODE_PENJUALAN ||
        t.rincian.some((r) => r.kodeAkun.kode === KODE_PENJUALAN)
      );
    });
    if (boleh.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada penjualan kode 400 yang bisa diverifikasi" },
        { status: 400 }
      );
    }

    const sekarang = new Date();
    await prisma.$transaction([
      prisma.transaksi.updateMany({
        where: { id: { in: boleh.map((t) => t.id) } },
        data: verified
          ? { diverifikasiPada: sekarang, diverifikasiOlehId: auth.user.id }
          : { diverifikasiPada: null, diverifikasiOlehId: null },
      }),
      prisma.auditLog.createMany({
        data: boleh.map((t) => ({
          userId: auth.user.id,
          entitas: "Transaksi",
          entitasId: t.id,
          aksi: AksiAudit.UBAH,
          dataLama: { verified: t.diverifikasiPada != null },
          dataBaru: { verified },
        })),
      }),
    ]);

    return NextResponse.json({
      diubah: boleh.length,
      dilewati: ids.length - boleh.length,
      verified,
    });
  } catch (err) {
    return apiError(err);
  }
}
