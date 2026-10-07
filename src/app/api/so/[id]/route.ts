import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehAcc, bolehKelola, bolehLihatLaporan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit, JenisSo, StatusAcc } from "@/generated/prisma/enums";

type Params = { params: Promise<{ id: string }> };
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Rincian satu SO per SKU. HPP dan nilai disembunyikan untuk role tanpa akses laporan. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const so = await prisma.stokOpname.findUnique({
      where: { id },
      include: {
        items: { include: { brand: { select: { nama: true } } }, orderBy: [{ brand: { nama: "asc" } }, { sku: "asc" }] },
      },
    });
    if (!so) return NextResponse.json({ error: "SO tidak ditemukan" }, { status: 404 });
    const lihatNilai = bolehLihatLaporan(auth.user.role);
    return NextResponse.json({
      id: so.id,
      jenis: so.jenis,
      posisiPada: iso(so.posisiPada),
      items: so.items.map((i) => ({
        sku: i.sku,
        brand: i.brand.nama,
        stok: i.stok,
        hpp: lihatNilai ? i.hpp.toNumber() : null,
        nilai: lihatNilai ? i.nilai.toNumber() : null,
      })),
      lihatNilai,
    });
  } catch (err) {
    return apiError(err);
  }
}

/** ACC SO yang diunggah STAFF/BENDAHARA. */
export async function PATCH(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehAcc);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const so = await prisma.stokOpname.findUnique({ where: { id } });
    if (!so) return NextResponse.json({ error: "SO tidak ditemukan" }, { status: 404 });
    if (so.statusAcc === StatusAcc.DISETUJUI) return NextResponse.json({ ok: true });

    await prisma.$transaction([
      prisma.stokOpname.update({
        where: { id },
        data: { statusAcc: StatusAcc.DISETUJUI, accOlehId: auth.user.id, accPada: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "StokOpname",
          entitasId: id,
          aksi: AksiAudit.UBAH,
          dataLama: { statusAcc: so.statusAcc },
          dataBaru: { statusAcc: StatusAcc.DISETUJUI },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const so = await prisma.stokOpname.findUnique({ where: { id } });
    if (!so) return NextResponse.json({ error: "SO tidak ditemukan" }, { status: 404 });

    if (so.jenis === JenisSo.AWAL) {
      const adaBulanan = await prisma.stokOpname.count({ where: { jenis: JenisSo.BULANAN } });
      if (adaBulanan > 0) {
        return NextResponse.json(
          { error: "Persediaan Awal tidak bisa dihapus selama masih ada SO Bulanan. Unggah ulang untuk menimpanya." },
          { status: 409 }
        );
      }
    }

    await prisma.$transaction([
      prisma.stokOpname.delete({ where: { id } }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "StokOpname",
          entitasId: id,
          aksi: AksiAudit.HAPUS,
          dataLama: {
            jenis: so.jenis,
            posisiPada: iso(so.posisiPada),
            jumlahSku: so.jumlahSku,
            totalNilai: so.totalNilai.toFixed(2),
          },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
