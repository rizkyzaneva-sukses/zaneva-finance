import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { tanggalValid } from "@/lib/jurnal-penyesuaian";
import { buatPdfJurnal } from "@/lib/jurnal-pdf";

export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLaporan);
  if (!auth.ok) return auth.response;

  try {
    const url = new URL(req.url);
    const dari = url.searchParams.get("dari") ?? "";
    const sampai = url.searchParams.get("sampai") ?? "";
    const brandId = url.searchParams.get("brandId") ?? "";
    if (!tanggalValid(dari) || !tanggalValid(sampai) || dari > sampai) {
      return NextResponse.json({ error: "Periode tidak valid" }, { status: 400 });
    }
    if (brandId && auth.user.brandIds && !auth.user.brandIds.includes(brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }

    const [brand, jurnal] = await Promise.all([
      brandId ? prisma.brand.findUnique({ where: { id: brandId }, select: { nama: true } }) : Promise.resolve(null),
      prisma.jurnalPenyesuaian.findMany({
        where: {
          tanggal: {
            gte: new Date(`${dari}T00:00:00.000Z`),
            lte: new Date(`${sampai}T00:00:00.000Z`),
          },
          ...(brandId
            ? { brandId }
            : auth.user.brandIds
              ? { brandId: { in: auth.user.brandIds } }
              : {}),
        },
        orderBy: [{ tanggal: "asc" }, { nomor: "asc" }],
        include: {
          brand: { select: { nama: true } },
          pembalik: { select: { tanggal: true } },
          pembalikDari: { select: { nomor: true } },
          baris: {
            orderBy: { urutan: "asc" },
            include: { kodeAkun: { select: { kode: true, nama: true } } },
          },
        },
      }),
    ]);

    const pdf = await buatPdfJurnal({
      dari,
      sampai,
      brand: brand?.nama ?? null,
      jurnal: jurnal.map((j) => ({
        nomor: j.nomor,
        tanggal: j.tanggal.toISOString().slice(0, 10),
        keterangan: j.keterangan,
        brand: j.brand.nama,
        dibalik: j.dibalik,
        pembalikTanggal: j.pembalik ? j.pembalik.tanggal.toISOString().slice(0, 10) : null,
        asalNomor: j.pembalikDari?.nomor ?? null,
        baris: j.baris.map((b) => ({
          kode: b.kodeAkun.kode,
          nama: b.kodeAkun.nama,
          debit: Number(b.debit),
          kredit: Number(b.kredit),
        })),
      })),
    });

    const nama = `jurnal-penyesuaian_${dari}_${sampai}.pdf`;
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nama}"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
