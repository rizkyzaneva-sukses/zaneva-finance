import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehRekening } from "@/lib/akses";
import { bolehAksesRekening } from "@/lib/acc";
import { prisma } from "@/lib/prisma";
import { balikArah, rapikanIds } from "@/lib/unggahan";

/** Tukar kolom Masuk dan Keluar pada transaksi yang sudah tersimpan. */
export async function POST(req: Request) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const ids = rapikanIds(body.ids);
    if (ids.length === 0) return NextResponse.json({ error: "Tidak ada transaksi yang dipilih" }, { status: 400 });
    if (ids.length > 1000) return NextResponse.json({ error: "Maksimal 1000 transaksi sekaligus" }, { status: 400 });

    const rows = await prisma.transaksi.findMany({
      where: { id: { in: ids } },
      select: { id: true, rekeningId: true, rekening: { select: { bank: true } } },
    });
    if (rows.some((r) => !bolehRekening(auth.user, r.rekeningId))) {
      return NextResponse.json({ error: "Ada transaksi di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    if (rows.some((r) => !bolehAksesRekening(auth.user.role, r.rekening.bank))) {
      return NextResponse.json({ error: "Ada transaksi di rekening yang tidak boleh kamu ubah" }, { status: 403 });
    }

    const hasil = await prisma.$transaction(
      (tx) => balikArah(tx, rows.map((r) => r.id), auth.user),
      { timeout: 60_000 }
    );
    return NextResponse.json(hasil);
  } catch (err) {
    return apiError(err);
  }
}
