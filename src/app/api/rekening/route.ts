import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Bank, Role } from "@/generated/prisma/enums";

export async function GET() {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const rekening = await prisma.rekening.findMany({
      // BENDAHARA hanya perlu (dan boleh) melihat kas tunai
      where: auth.user.role === Role.BENDAHARA ? { bank: Bank.PETTY_CASH } : undefined,
      orderBy: [{ urutan: "asc" }, { nama: "asc" }],
      include: { _count: { select: { transaksi: true } } },
    });
    return NextResponse.json({ rekening });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const nama = String(body.nama ?? "").trim();
    const bank = String(body.bank ?? "") as Bank;
    const tanggalSaldoAwal = String(body.tanggalSaldoAwal ?? "");

    if (!nama) return NextResponse.json({ error: "Nama rekening wajib diisi" }, { status: 400 });
    if (!Object.values(Bank).includes(bank)) {
      return NextResponse.json({ error: "Bank tidak valid" }, { status: 400 });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalSaldoAwal)) {
      return NextResponse.json({ error: "Tanggal saldo awal wajib diisi" }, { status: 400 });
    }

    const sudahAda = await prisma.rekening.findUnique({ where: { nama } });
    if (sudahAda) {
      return NextResponse.json({ error: `Rekening "${nama}" sudah ada` }, { status: 409 });
    }

    const rekening = await prisma.rekening.create({
      data: {
        nama,
        bank,
        nomorRekening: String(body.nomorRekening ?? "").trim() || null,
        saldoAwal: new Prisma.Decimal(body.saldoAwal || 0),
        tanggalSaldoAwal: new Date(`${tanggalSaldoAwal}T00:00:00.000Z`),
        urutan: Number(body.urutan) || 0,
      },
    });

    return NextResponse.json({ rekening });
  } catch (err) {
    return apiError(err);
  }
}
