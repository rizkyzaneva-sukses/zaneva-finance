import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehAcc } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit, StatusAcc } from "@/generated/prisma/enums";

/**
 * Sahkan transaksi yang menunggu ACC (hasil kerja STAFF/BENDAHARA).
 * Tidak mengubah isi transaksi — kalau isinya salah, ADMIN cukup membetulkannya
 * lewat edit biasa, yang otomatis mengesahkan.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehAcc);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "Tidak ada transaksi yang dipilih" }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: "Maksimal 500 transaksi sekali ACC" }, { status: 400 });
    }

    const hasil = await prisma.$transaction(async (tx) => {
      // Hanya yang memang masih menunggu — yang sudah disetujui dilewati,
      // jadi menekan tombol dua kali tidak menimpa jejak ACC pertama.
      const menunggu = await tx.transaksi.findMany({
        where: {
          id: { in: ids },
          statusAcc: StatusAcc.MENUNGGU,
          // Pengguna yang dibatasi brand hanya bisa meng-ACC transaksi rekening brand-nya
          ...(auth.user.rekeningIds ? { rekeningId: { in: auth.user.rekeningIds } } : {}),
        },
        select: { id: true },
      });
      if (menunggu.length === 0) return { disahkan: 0 };

      const sekarang = new Date();
      await tx.transaksi.updateMany({
        where: { id: { in: menunggu.map((m) => m.id) } },
        data: { statusAcc: StatusAcc.DISETUJUI, accOlehId: auth.user.id, accPada: sekarang },
      });
      await tx.auditLog.createMany({
        data: menunggu.map((m) => ({
          userId: auth.user.id,
          entitas: "Transaksi",
          entitasId: m.id,
          aksi: AksiAudit.UBAH,
          dataLama: { statusAcc: StatusAcc.MENUNGGU },
          dataBaru: { statusAcc: StatusAcc.DISETUJUI },
        })),
      });
      return { disahkan: menunggu.length };
    });

    return NextResponse.json({ ...hasil, diminta: ids.length });
  } catch (err) {
    return apiError(err);
  }
}
