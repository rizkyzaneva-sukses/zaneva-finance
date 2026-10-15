import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehAccFinance } from "@/lib/auth";
import { bolehAksesRekening } from "@/lib/acc";
import { bolehRekening } from "@/lib/akses";
import { prisma } from "@/lib/prisma";
import { pindahRekening, rapikanIds } from "@/lib/unggahan";
import { labelRekening } from "@/lib/utils";

/** Pindahkan transaksi terpilih ke rekening lain. Hanya Finance. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehAccFinance);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const ids = rapikanIds(body.ids);
    const rekeningTujuanId = typeof body.rekeningTujuanId === "string" ? body.rekeningTujuanId : "";
    if (ids.length === 0 || !rekeningTujuanId) {
      return NextResponse.json({ error: "Pilih transaksi dan rekening tujuan" }, { status: 400 });
    }
    if (ids.length > 1000) return NextResponse.json({ error: "Maksimal 1000 transaksi sekaligus" }, { status: 400 });
    if (!bolehRekening(auth.user, rekeningTujuanId)) {
      return NextResponse.json({ error: "Rekening tujuan di luar brand kamu" }, { status: 403 });
    }

    const tujuan = await prisma.rekening.findUnique({
      where: { id: rekeningTujuanId },
      select: { nama: true, nomorRekening: true, bank: true, aktif: true },
    });
    if (!tujuan || !tujuan.aktif) {
      return NextResponse.json({ error: "Rekening tujuan tidak ditemukan" }, { status: 404 });
    }
    if (!bolehAksesRekening(auth.user.role, tujuan.bank)) {
      return NextResponse.json({ error: "Kamu tidak boleh memindahkan ke rekening itu" }, { status: 403 });
    }

    const rows = await prisma.transaksi.findMany({
      where: { id: { in: ids } },
      select: { id: true, rekeningId: true },
    });
    if (rows.some((r) => !bolehRekening(auth.user, r.rekeningId))) {
      return NextResponse.json({ error: "Ada transaksi di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }

    const jumlah = await prisma.$transaction(
      (tx) => pindahRekening(tx, rows.map((r) => r.id), rekeningTujuanId, auth.user.id),
      { timeout: 60_000 }
    );
    return NextResponse.json({ jumlah, tujuan: labelRekening(tujuan.nama, tujuan.nomorRekening) });
  } catch (err) {
    return apiError(err);
  }
}
