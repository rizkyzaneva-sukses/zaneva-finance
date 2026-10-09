import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehJurnalPenyesuaian, bolehLihatLaporan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { bacaBaris, buatJurnal, tanggalValid } from "@/lib/jurnal-penyesuaian";

function bolehBrand(brandIds: string[] | null, brandId: string) {
  return brandIds === null || brandIds.includes(brandId);
}

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
    if (brandId && !bolehBrand(auth.user.brandIds, brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }

    const jurnal = await prisma.jurnalPenyesuaian.findMany({
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
        brand: { select: { id: true, nama: true } },
        dibuatOleh: { select: { nama: true } },
        pembalik: { select: { id: true, nomor: true, tanggal: true } },
        pembalikDari: { select: { id: true, nomor: true, tanggal: true } },
        baris: {
          orderBy: { urutan: "asc" },
          include: { kodeAkun: { select: { id: true, kode: true, nama: true, kelompok: true } } },
        },
      },
    });

    return NextResponse.json({
      bolehUbah: bolehJurnalPenyesuaian(auth.user.role),
      jurnal: jurnal.map((j) => ({
        id: j.id,
        nomor: j.nomor,
        tanggal: j.tanggal.toISOString().slice(0, 10),
        keterangan: j.keterangan,
        dibalik: j.dibalik,
        pembalik: j.pembalik
          ? { id: j.pembalik.id, nomor: j.pembalik.nomor, tanggal: j.pembalik.tanggal.toISOString().slice(0, 10) }
          : null,
        asal: j.pembalikDari
          ? { id: j.pembalikDari.id, nomor: j.pembalikDari.nomor, tanggal: j.pembalikDari.tanggal.toISOString().slice(0, 10) }
          : null,
        brand: j.brand,
        dibuatOleh: j.dibuatOleh?.nama ?? null,
        baris: j.baris.map((b) => ({
          kodeAkunId: b.kodeAkunId,
          kode: b.kodeAkun.kode,
          nama: b.kodeAkun.nama,
          kelompok: b.kodeAkun.kelompok,
          debit: Number(b.debit),
          kredit: Number(b.kredit),
        })),
      })),
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehJurnalPenyesuaian);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const brandId = String(body.brandId ?? "");
    const tanggal = String(body.tanggal ?? "");
    const keterangan = String(body.keterangan ?? "").trim().replace(/\s+/g, " ");
    const dibalik = Boolean(body.dibalik);
    if (!brandId) return NextResponse.json({ error: "Pilih brand dulu" }, { status: 400 });
    if (!bolehBrand(auth.user.brandIds, brandId)) {
      return NextResponse.json({ error: "Brand ini di luar penugasan kamu" }, { status: 403 });
    }
    if (!tanggalValid(tanggal)) return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
    if (!keterangan) return NextResponse.json({ error: "Keterangan wajib diisi" }, { status: 400 });
    if (keterangan.length > 300) {
      return NextResponse.json({ error: "Keterangan maksimal 300 karakter" }, { status: 400 });
    }
    const baris = bacaBaris(body.baris);
    if (!baris.ok) return NextResponse.json({ error: baris.error }, { status: 400 });

    const hasil = await buatJurnal({
      brandId,
      tanggal,
      keterangan,
      dibalik,
      baris: baris.baris,
      userId: auth.user.id,
    });
    if (!hasil.ok) return NextResponse.json({ error: hasil.error }, { status: 400 });
    return NextResponse.json({ id: hasil.id });
  } catch (err) {
    return apiError(err);
  }
}
