import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehTutupBuku } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit } from "@/generated/prisma/enums";
import { bulanSudahBerakhir, bulanValid, labaBulan } from "@/lib/alokasi";

/**
 * OWNER mengesahkan laba bersih satu bulan. Angkanya dihitung ulang di server
 * dan disimpan sebagai snapshot — tidak pernah dipercaya dari klien.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehTutupBuku);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const bln = bulanValid(body.tahun, body.bulan);
    if (!bln) return NextResponse.json({ error: "Tahun dan bulan tidak valid" }, { status: 400 });

    if (!bulanSudahBerakhir(bln.tahun, bln.bulan)) {
      return NextResponse.json(
        { error: "Bulan ini belum berakhir, labanya belum final. Tutup buku setelah bulannya selesai." },
        { status: 400 }
      );
    }

    const ada = await prisma.periodeLaba.findUnique({
      where: { tahun_bulan: { tahun: bln.tahun, bulan: bln.bulan } },
      include: { _count: { select: { distribusi: true } } },
    });
    if (ada && ada._count.distribusi > 0) {
      return NextResponse.json(
        { error: "Bulan ini sudah dibagikan alokasinya. Batalkan distribusinya dulu kalau labanya perlu disahkan ulang." },
        { status: 409 }
      );
    }

    const { laba } = await labaBulan(bln.tahun, bln.bulan);
    const labaDecimal = new Prisma.Decimal(laba.toFixed(2));
    const label = `${bln.tahun}-${String(bln.bulan).padStart(2, "0")}`;

    const hasil = await prisma.$transaction(async (tx) => {
      const rec = ada
        ? await tx.periodeLaba.update({
            where: { id: ada.id },
            data: { labaBersih: labaDecimal, disetujuiOlehId: auth.user.id, disetujuiPada: new Date() },
          })
        : await tx.periodeLaba.create({
            data: {
              tahun: bln.tahun,
              bulan: bln.bulan,
              labaBersih: labaDecimal,
              disetujuiOlehId: auth.user.id,
            },
          });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "PeriodeLaba",
          entitasId: rec.id,
          aksi: ada ? AksiAudit.UBAH : AksiAudit.BUAT,
          dataLama: ada ? { periode: label, labaBersih: ada.labaBersih.toFixed(2) } : undefined,
          dataBaru: { periode: label, labaBersih: labaDecimal.toFixed(2) },
        },
      });
      return rec;
    });

    return NextResponse.json({ periode: hasil, labaBersih: laba });
  } catch (err) {
    return apiError(err);
  }
}

/** Buka kembali bulan yang sudah disahkan — hanya kalau belum ada distribusinya. */
export async function DELETE(req: Request) {
  const auth = await wajibLogin(bolehTutupBuku);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const bln = bulanValid(sp.get("tahun"), sp.get("bulan"));
    if (!bln) return NextResponse.json({ error: "Tahun dan bulan tidak valid" }, { status: 400 });

    const rec = await prisma.periodeLaba.findUnique({
      where: { tahun_bulan: { tahun: bln.tahun, bulan: bln.bulan } },
      include: { _count: { select: { distribusi: true } } },
    });
    if (!rec) return NextResponse.json({ error: "Bulan ini belum disahkan" }, { status: 404 });
    if (rec._count.distribusi > 0) {
      return NextResponse.json(
        { error: "Sudah ada distribusi alokasi untuk bulan ini. Batalkan distribusinya dulu." },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.periodeLaba.delete({ where: { id: rec.id } }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "PeriodeLaba",
          entitasId: rec.id,
          aksi: AksiAudit.HAPUS,
          dataLama: {
            periode: `${rec.tahun}-${String(rec.bulan).padStart(2, "0")}`,
            labaBersih: rec.labaBersih.toFixed(2),
          },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
