import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, Bank } from "@/generated/prisma/enums";
import { hitungUlangSaldo } from "@/lib/rekap";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const lama = await prisma.rekening.findUnique({ where: { id } });
    if (!lama) return NextResponse.json({ error: "Rekening tidak ditemukan" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Prisma.RekeningUpdateInput = {};

    if (typeof body.nama === "string" && body.nama.trim()) data.nama = body.nama.trim();
    if (Object.values(Bank).includes(body.bank)) data.bank = body.bank;
    if (typeof body.nomorRekening === "string") data.nomorRekening = body.nomorRekening.trim() || null;
    if (typeof body.aktif === "boolean") data.aktif = body.aktif;
    if (body.urutan !== undefined) data.urutan = Number(body.urutan) || 0;
    if (body.brandId !== undefined) {
      data.brand = body.brandId ? { connect: { id: String(body.brandId) } } : { disconnect: true };
    }

    // Mengubah titik nol pembukuan menggeser saldo seluruh transaksi rekening ini.
    const saldoAwalBerubah =
      body.saldoAwal !== undefined && !new Prisma.Decimal(body.saldoAwal).equals(lama.saldoAwal);
    if (saldoAwalBerubah) data.saldoAwal = new Prisma.Decimal(body.saldoAwal);
    if (typeof body.tanggalSaldoAwal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.tanggalSaldoAwal)) {
      data.tanggalSaldoAwal = new Date(`${body.tanggalSaldoAwal}T00:00:00.000Z`);
    }

    const rekening = await prisma.$transaction(async (tx) => {
      const hasil = await tx.rekening.update({ where: { id }, data });
      if (saldoAwalBerubah) await hitungUlangSaldo(tx, id);
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "Rekening",
          entitasId: id,
          aksi: AksiAudit.UBAH,
          dataLama: { nama: lama.nama, saldoAwal: lama.saldoAwal.toFixed(2), aktif: lama.aktif, brandId: lama.brandId },
          dataBaru: { nama: hasil.nama, saldoAwal: hasil.saldoAwal.toFixed(2), aktif: hasil.aktif, brandId: hasil.brandId },
        },
      });
      return hasil;
    });

    return NextResponse.json({ rekening, saldoDihitungUlang: saldoAwalBerubah });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const jumlah = await prisma.transaksi.count({ where: { rekeningId: id } });
    if (jumlah > 0) {
      return NextResponse.json(
        {
          error: `Rekening ini punya ${jumlah} transaksi, jadi tidak bisa dihapus. Nonaktifkan saja supaya riwayatnya tetap utuh.`,
        },
        { status: 409 }
      );
    }

    const lama = await prisma.rekening.findUnique({ where: { id } });
    await prisma.rekening.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        entitas: "Rekening",
        entitasId: id,
        aksi: AksiAudit.HAPUS,
        // Data lama disimpan karena barisnya sudah tidak ada lagi untuk dilihat.
        dataLama: lama
          ? { nama: lama.nama, bank: lama.bank, saldoAwal: lama.saldoAwal.toFixed(2) }
          : undefined,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
