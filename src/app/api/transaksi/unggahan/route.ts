import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehAccFinance, bolehRekap } from "@/lib/auth";
import { bolehAksesRekening } from "@/lib/acc";
import { bolehRekening } from "@/lib/akses";
import { prisma } from "@/lib/prisma";
import { kunciUnggahan, pindahRekening, balikArah, whereDariKunci, type BarisKunci } from "@/lib/unggahan";
import { labelRekening } from "@/lib/utils";

/** Riwayat Simpan Semua pada satu rekening, plus pindah/balik satu unggahan. */
export async function GET(req: Request) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  try {
    const rekeningId = new URL(req.url).searchParams.get("rekeningId");
    if (!rekeningId) return NextResponse.json({ unggahan: [] });
    if (!bolehRekening(auth.user, rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }

    const sejak = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const rows = await prisma.transaksi.findMany({
      where: { rekeningId, createdAt: { gte: sejak } },
      select: {
        id: true,
        batchId: true,
        createdById: true,
        createdAt: true,
        sumber: true,
        tanggal: true,
        createdBy: { select: { nama: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 4000,
    });

    const grup = new Map<string, BarisKunci[]>();
    for (const r of rows) {
      const kunci = kunciUnggahan(r);
      const daftar = grup.get(kunci);
      if (daftar) daftar.push(r);
      else grup.set(kunci, [r]);
    }

    const unggahan = [...grup.entries()]
      .map(([kunci, daftar]) => {
        const tanggal = daftar.map((d) => d.tanggal.getTime());
        const dibuat = daftar.map((d) => d.createdAt.getTime());
        return {
          kunci,
          jumlah: daftar.length,
          pembuat: daftar[0].createdBy?.nama ?? "—",
          sumber: daftar[0].sumber,
          dibuatPada: new Date(Math.max(...dibuat)).toISOString(),
          dari: new Date(Math.min(...tanggal)).toISOString(),
          sampai: new Date(Math.max(...tanggal)).toISOString(),
        };
      })
      .sort((a, b) => b.dibuatPada.localeCompare(a.dibuatPada))
      .slice(0, 12);

    return NextResponse.json({ unggahan });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehAccFinance);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const aksi = body.aksi === "balik" ? "balik" : body.aksi === "pindah" ? "pindah" : null;
    const kunci = typeof body.kunci === "string" ? body.kunci : "";
    const rekeningAsalId = typeof body.rekeningAsalId === "string" ? body.rekeningAsalId : "";
    const rekeningTujuanId = typeof body.rekeningTujuanId === "string" ? body.rekeningTujuanId : "";
    if (!aksi || !kunci || !rekeningAsalId) {
      return NextResponse.json({ error: "Permintaan tidak lengkap" }, { status: 400 });
    }
    if (!bolehRekening(auth.user, rekeningAsalId)) {
      return NextResponse.json({ error: "Rekening asal di luar brand kamu" }, { status: 403 });
    }

    const where = whereDariKunci(rekeningAsalId, kunci);
    if (!where) return NextResponse.json({ error: "Unggahan tidak dikenali" }, { status: 400 });

    const calon = await prisma.transaksi.findMany({ where, select: { id: true } });
    if (calon.length === 0) return NextResponse.json({ error: "Unggahan itu sudah tidak ada di rekening ini" }, { status: 404 });
    if (calon.length > 2000) {
      return NextResponse.json({ error: "Terlalu banyak transaksi dalam satu unggahan" }, { status: 400 });
    }

    if (aksi === "pindah") {
      if (!rekeningTujuanId || rekeningTujuanId === rekeningAsalId) {
        return NextResponse.json({ error: "Pilih rekening tujuan yang berbeda" }, { status: 400 });
      }
      if (!bolehRekening(auth.user, rekeningTujuanId)) {
        return NextResponse.json({ error: "Rekening tujuan di luar brand kamu" }, { status: 403 });
      }
      const tujuan = await prisma.rekening.findUnique({
        where: { id: rekeningTujuanId },
        select: { id: true, nama: true, nomorRekening: true, bank: true, aktif: true },
      });
      if (!tujuan || !tujuan.aktif) {
        return NextResponse.json({ error: "Rekening tujuan tidak ditemukan" }, { status: 404 });
      }
      if (!bolehAksesRekening(auth.user.role, tujuan.bank)) {
        return NextResponse.json({ error: "Kamu tidak boleh memindahkan ke rekening itu" }, { status: 403 });
      }

      const jumlah = await prisma.$transaction(
        (tx) => pindahRekening(tx, calon.map((c) => c.id), rekeningTujuanId, auth.user.id),
        { timeout: 60_000 }
      );
      return NextResponse.json({
        jumlah,
        tujuan: labelRekening(tujuan.nama, tujuan.nomorRekening),
      });
    }

    const hasil = await prisma.$transaction(
      (tx) => balikArah(tx, calon.map((c) => c.id), auth.user),
      { timeout: 60_000 }
    );
    return NextResponse.json(hasil);
  } catch (err) {
    return apiError(err);
  }
}
