import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehAksesRekening, dataAccUntukPerubahan } from "@/lib/acc";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, StatusKode } from "@/generated/prisma/enums";
import { validasiRincian } from "@/lib/split";
import { bolehRekening } from "@/lib/akses";

type Params = { params: Promise<{ id: string }> };

/**
 * Ganti seluruh rincian split sebuah transaksi.
 * Array kosong = batalkan split (transaksi kembali tanpa kode, perlu diberi kode lagi).
 * Nominal & saldo transaksi induk tidak berubah, jadi saldo berjalan tidak perlu dihitung ulang.
 */
export async function PUT(req: Request, { params }: Params) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const induk = await prisma.transaksi.findUnique({
      where: { id },
      include: { rincian: { orderBy: { urutan: "asc" } }, rekening: { select: { bank: true } } },
    });
    if (!induk) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    if (!bolehRekening(auth.user, induk.rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    if (!bolehAksesRekening(auth.user.role, induk.rekening.bank)) {
      return NextResponse.json({ error: "Akses ditolak untuk rekening ini" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const masuk = Array.isArray(body.rincian) ? body.rincian : null;
    if (!masuk) return NextResponse.json({ error: "Rincian wajib berupa daftar" }, { status: 400 });

    const total = induk.uangMasuk.gt(0) ? induk.uangMasuk : induk.uangKeluar;
    let rincianBaru: Prisma.TransaksiRincianCreateManyInput[] = [];

    if (masuk.length > 0) {
      const cek = await validasiRincian(total, masuk);
      if (!cek.ok) return NextResponse.json({ error: cek.error }, { status: 400 });
      rincianBaru = cek.rincian.map((r) => ({
        transaksiId: id,
        kodeAkunId: r.kodeAkunId,
        nominal: r.nominal,
        keterangan: r.keterangan,
        urutan: r.urutan,
      }));
    }

    const ringkas = (list: { kodeAkunId: string; nominal: Prisma.Decimal | string; keterangan: string | null }[]) =>
      list.map((r) => ({
        kodeAkunId: r.kodeAkunId,
        nominal: new Prisma.Decimal(r.nominal).toFixed(2),
        keterangan: r.keterangan,
      }));

    const hasil = await prisma.$transaction(async (tx) => {
      await tx.transaksiRincian.deleteMany({ where: { transaksiId: id } });
      if (rincianBaru.length > 0) await tx.transaksiRincian.createMany({ data: rincianBaru });

      await tx.transaksi.update({
        where: { id },
        data: {
          // Di-split: kode induk dikosongkan, kodenya hidup di rincian.
          // Split dibatalkan: kembali ke "belum ada kode" supaya muncul di daftar belum beres.
          kodeAkun: { disconnect: true },
          statusKode: rincianBaru.length > 0 ? StatusKode.DIKONFIRMASI : StatusKode.KOSONG,
          updatedBy: { connect: { id: auth.user.id } },
          ...dataAccUntukPerubahan(auth.user),
        },
      });

      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "Transaksi",
          entitasId: id,
          aksi: AksiAudit.UBAH,
          dataLama: { split: ringkas(induk.rincian) },
          dataBaru: { split: ringkas(rincianBaru as never) },
        },
      });

      return tx.transaksiRincian.findMany({
        where: { transaksiId: id },
        orderBy: { urutan: "asc" },
        include: { kodeAkun: { select: { id: true, kode: true, nama: true } } },
      });
    });

    return NextResponse.json({ rincian: hasil });
  } catch (err) {
    return apiError(err);
  }
}
