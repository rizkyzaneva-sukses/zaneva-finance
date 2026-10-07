import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AktivitasKas, Kelompok, Laporan } from "@/generated/prisma/enums";
import { bacaPersenAlokasi } from "@/lib/split";

export async function GET(req: Request) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const hanyaAktif = new URL(req.url).searchParams.get("aktif") === "1";
    const kodeAkun = await prisma.kodeAkun.findMany({
      where: hanyaAktif ? { aktif: true } : undefined,
      orderBy: [{ urutan: "asc" }, { kode: "asc" }],
      include: { _count: { select: { transaksi: true, rincian: true } } },
    });
    return NextResponse.json({ kodeAkun });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const kode = String(body.kode ?? "").trim();
    const nama = String(body.nama ?? "").trim();
    const kelompok = String(body.kelompok ?? "") as Kelompok;

    if (!kode) return NextResponse.json({ error: "Kode wajib diisi" }, { status: 400 });
    if (!nama) return NextResponse.json({ error: "Nama kode akun wajib diisi" }, { status: 400 });
    if (!Object.values(Kelompok).includes(kelompok)) {
      return NextResponse.json({ error: "Kelompok tidak valid" }, { status: 400 });
    }

    const sudahAda = await prisma.kodeAkun.findUnique({ where: { kode } });
    if (sudahAda) {
      return NextResponse.json({ error: `Kode "${kode}" sudah dipakai` }, { status: 409 });
    }

    const laporan = Object.values(Laporan).includes(body.laporan) ? (body.laporan as Laporan) : null;
    const aktivitasKas = Object.values(AktivitasKas).includes(body.aktivitasKas)
      ? (body.aktivitasKas as AktivitasKas)
      : null;

    const persen = bacaPersenAlokasi(body.persenAlokasi);
    if (!persen.ok) return NextResponse.json({ error: persen.error }, { status: 400 });

    const terakhir = await prisma.kodeAkun.aggregate({ _max: { urutan: true } });
    const kodeAkun = await prisma.kodeAkun.create({
      data: {
        kode,
        nama,
        kelompok,
        laporan,
        aktivitasKas,
        persenAlokasi: persen.nilai,
        urutan: (terakhir._max.urutan ?? 0) + 1,
      },
    });

    return NextResponse.json({ kodeAkun });
  } catch (err) {
    return apiError(err);
  }
}
