import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehPertumbuhanBisnis } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit } from "@/generated/prisma/enums";
import {
  hitungSubtotal,
  hitungUlangPertumbuhanBrand,
  type InputPertumbuhan,
} from "@/lib/pertumbuhan-bisnis";

/**
 * GET /api/pertumbuhan-bisnis
 * Mengambil rekap pertumbuhan bisnis per brand & konsolidasi seluruh brand.
 * Akses: Hanya FINANCE (ADMIN) dan OWNER.
 */
export async function GET(req: Request) {
  const auth = await wajibLogin(bolehPertumbuhanBisnis, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const filterBrandId = searchParams.get("brandId");
    const filterTahun = searchParams.get("tahun") ? Number(searchParams.get("tahun")) : undefined;

    // Ambil semua brand aktif non-dummy
    const brands = await prisma.brand.findMany({
      where: {
        NOT: { nama: { startsWith: "[DUMMY]" } },
      },
      orderBy: { nama: "asc" },
      select: { id: true, nama: true, kunci: true },
    });

    const whereClause: Prisma.PertumbuhanBisnisWhereInput = {};
    if (filterBrandId) whereClause.brandId = filterBrandId;
    if (filterTahun) whereClause.tahun = filterTahun;

    const records = await prisma.pertumbuhanBisnis.findMany({
      where: whereClause,
      include: {
        brand: { select: { id: true, nama: true } },
        dibuatOleh: { select: { id: true, nama: true } },
        diubahOleh: { select: { id: true, nama: true } },
      },
      orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
    });

    // Susun matriks konsolidasi bulanan seluruh brand
    const periodeSet = new Set<string>();
    const allRecordsForKonsolidasi = await prisma.pertumbuhanBisnis.findMany({
      include: { brand: { select: { id: true, nama: true } } },
      orderBy: [{ tahun: "asc" }, { bulan: "asc" }],
    });

    allRecordsForKonsolidasi.forEach((r) => {
      periodeSet.add(`${r.tahun}-${String(r.bulan).padStart(2, "0")}`);
    });
    const daftarPeriode = Array.from(periodeSet).sort();

    const dataByBrandPeriode: { [brandId: string]: { [periode: string]: (typeof allRecordsForKonsolidasi)[0] } } = {};
    for (const r of allRecordsForKonsolidasi) {
      if (!dataByBrandPeriode[r.brandId]) dataByBrandPeriode[r.brandId] = {};
      const p = `${r.tahun}-${String(r.bulan).padStart(2, "0")}`;
      dataByBrandPeriode[r.brandId][p] = r;
    }

    let prevGrandTotal = 0;
    const konsolidasi = daftarPeriode.map((periode, idx) => {
      const [thn, bln] = periode.split("-").map(Number);
      const perBrand: { [brandId: string]: { total: number; pertumbuhan: number } } = {};
      let totalSemuaBrand = 0;

      for (const b of brands) {
        const item = dataByBrandPeriode[b.id]?.[periode];
        const tot = item ? Number(item.total) : 0;
        const pert = item ? Number(item.pertumbuhanNominal) : 0;
        perBrand[b.id] = { total: tot, pertumbuhan: pert };
        totalSemuaBrand += tot;
      }

      const pertumbuhanKonsolidasi = idx === 0 ? 0 : totalSemuaBrand - prevGrandTotal;
      const pertumbuhanPersenKonsolidasi =
        idx === 0 || prevGrandTotal === 0 ? null : (pertumbuhanKonsolidasi / Math.abs(prevGrandTotal)) * 100;

      prevGrandTotal = totalSemuaBrand;

      return {
        periode,
        tahun: thn,
        bulan: bln,
        perBrand,
        total: totalSemuaBrand,
        pertumbuhan: pertumbuhanKonsolidasi,
        pertumbuhanPersen: pertumbuhanPersenKonsolidasi,
      };
    });

    // Ringkasan KPI bulan terakhir
    const latestKonsolidasi = konsolidasi.length > 0 ? konsolidasi[konsolidasi.length - 1] : null;
    const prevKonsolidasi = konsolidasi.length > 1 ? konsolidasi[konsolidasi.length - 2] : null;

    return NextResponse.json({
      brands,
      records,
      konsolidasi,
      ringkasan: {
        bulanTerakhir: latestKonsolidasi?.periode || null,
        totalAsetTerakhir: latestKonsolidasi?.total || 0,
        pertumbuhanTerakhir: latestKonsolidasi?.pertumbuhan || 0,
        pertumbuhanPersenTerakhir: latestKonsolidasi?.pertumbuhanPersen || 0,
        totalBulanSebelumnya: prevKonsolidasi?.total || 0,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

/**
 * POST /api/pertumbuhan-bisnis
 * Tambah atau perbarui data rekap bulanan (input manual oleh tim Finance).
 * Akses: Hanya FINANCE (ADMIN) dan OWNER.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehPertumbuhanBisnis, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<InputPertumbuhan>;

    if (!body.brandId) {
      return NextResponse.json({ error: "Brand wajib dipilih" }, { status: 400 });
    }
    const tahun = Number(body.tahun);
    const bulan = Number(body.bulan);
    if (!tahun || tahun < 2020 || tahun > 2099) {
      return NextResponse.json({ error: "Tahun tidak valid" }, { status: 400 });
    }
    if (!bulan || bulan < 1 || bulan > 12) {
      return NextResponse.json({ error: "Bulan harus antara 1 sampai 12" }, { status: 400 });
    }

    const brand = await prisma.brand.findUnique({ where: { id: body.brandId } });
    if (!brand) {
      return NextResponse.json({ error: "Brand tidak ditemukan" }, { status: 404 });
    }

    const subtotals = hitungSubtotal(body);
    const detailBank = body.detailBank || [];
    const hutangLainnya = Number(body.hutangLainnya) || 0;
    const keteranganHutang = body.keteranganHutang ? String(body.keteranganHutang).trim() : null;
    const catatan = body.catatan ? String(body.catatan).trim() : null;

    const dataPayload = {
      detailBank: (detailBank ?? []) as unknown as Prisma.InputJsonValue,
      cashOnBank: new Prisma.Decimal(subtotals.cashOnBank.toFixed(2)),
      kasBesar: new Prisma.Decimal(subtotals.kasBesar.toFixed(2)),
      kasKecil: new Prisma.Decimal(subtotals.kasKecil.toFixed(2)),
      cashOnHand: new Prisma.Decimal(subtotals.cashOnHand.toFixed(2)),
      piutangVendor: new Prisma.Decimal(subtotals.piutangVendor.toFixed(2)),
      utangVendor: new Prisma.Decimal(subtotals.utangVendor.toFixed(2)),
      outstandingShopeeLazada: new Prisma.Decimal(subtotals.outstandingShopeeLazada.toFixed(2)),
      outstandingSap: new Prisma.Decimal(subtotals.outstandingSap.toFixed(2)),
      outstandingJnt: new Prisma.Decimal(subtotals.outstandingJnt.toFixed(2)),
      outstandingTiktok: new Prisma.Decimal(subtotals.outstandingTiktok.toFixed(2)),
      outstandingLainnya: new Prisma.Decimal(subtotals.outstandingLainnya.toFixed(2)),
      outstanding: new Prisma.Decimal(subtotals.outstanding.toFixed(2)),
      inventory: new Prisma.Decimal(subtotals.inventory.toFixed(2)),
      total: new Prisma.Decimal(subtotals.total.toFixed(2)),
      hutangLainnya: new Prisma.Decimal(hutangLainnya.toFixed(2)),
      keteranganHutang,
      catatan,
    };

    const existing = await prisma.pertumbuhanBisnis.findUnique({
      where: {
        brandId_tahun_bulan: {
          brandId: body.brandId,
          tahun,
          bulan,
        },
      },
    });

    let record;
    if (existing) {
      record = await prisma.pertumbuhanBisnis.update({
        where: { id: existing.id },
        data: {
          ...dataPayload,
          diubahOlehId: auth.user.id,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "PertumbuhanBisnis",
          entitasId: record.id,
          aksi: AksiAudit.UBAH,
          dataLama: existing as any,
          dataBaru: record as any,
        },
      });
    } else {
      record = await prisma.pertumbuhanBisnis.create({
        data: {
          brandId: body.brandId,
          tahun,
          bulan,
          ...dataPayload,
          dibuatOlehId: auth.user.id,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "PertumbuhanBisnis",
          entitasId: record.id,
          aksi: AksiAudit.BUAT,
          dataBaru: record as any,
        },
      });
    }

    // Hitung ulang pergerakan pertumbuhan dan selisih inventory berurutan
    await hitungUlangPertumbuhanBrand(body.brandId);

    // Ambil data terbaru setelah hitung ulang
    const updatedRecord = await prisma.pertumbuhanBisnis.findUnique({
      where: { id: record.id },
      include: { brand: true },
    });

    return NextResponse.json({
      success: true,
      message: existing ? "Rekap bulan berhasil diperbarui" : "Rekap bulan berhasil ditambahkan",
      record: updatedRecord,
    });
  } catch (err) {
    return apiError(err);
  }
}
