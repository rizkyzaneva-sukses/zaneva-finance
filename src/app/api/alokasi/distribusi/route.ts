import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehBatalkanDistribusi, bolehDistribusiAlokasi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit } from "@/generated/prisma/enums";
import { bulanValid, hitungJatah, totalPersen } from "@/lib/alokasi";

const labelPeriode = (tahun: number, bulan: number) => `${tahun}-${String(bulan).padStart(2, "0")}`;

/**
 * ADMIN (Finance) mengesahkan pembagian jatah dari laba yang SUDAH disahkan OWNER.
 * Dasarnya selalu snapshot laba tersimpan, bukan laba yang dihitung ulang sekarang,
 * supaya yang dibagikan persis angka yang disetujui OWNER.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehDistribusiAlokasi);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const bln = bulanValid(body.tahun, body.bulan);
    if (!bln) return NextResponse.json({ error: "Tahun dan bulan tidak valid" }, { status: 400 });

    const periode = await prisma.periodeLaba.findUnique({
      where: { tahun_bulan: { tahun: bln.tahun, bulan: bln.bulan } },
      include: { _count: { select: { distribusi: true } } },
    });
    if (!periode) {
      return NextResponse.json(
        { error: "Laba bulan ini belum disahkan OWNER. Minta OWNER mengesahkan labanya dulu." },
        { status: 409 }
      );
    }
    if (periode._count.distribusi > 0) {
      return NextResponse.json({ error: "Bulan ini sudah dibagikan alokasinya" }, { status: 409 });
    }
    if (periode.labaBersih.lte(0)) {
      return NextResponse.json(
        { error: "Laba bulan ini nol atau rugi, jadi tidak ada yang dibagikan." },
        { status: 400 }
      );
    }

    const kode = await prisma.kodeAkun.findMany({
      where: { aktif: true, persenAlokasi: { gt: new Prisma.Decimal(0) } },
      select: { id: true, persenAlokasi: true },
    });
    if (kode.length === 0) {
      return NextResponse.json(
        { error: "Belum ada kode akun yang punya persentase alokasi. Isi dulu di halaman Kode Akun." },
        { status: 400 }
      );
    }
    const berpersen = kode.map((k) => ({ id: k.id, persen: k.persenAlokasi as Prisma.Decimal }));
    const persenTotal = totalPersen(berpersen);
    if (persenTotal.gt(100)) {
      return NextResponse.json(
        { error: `Total persentase alokasi ${persenTotal}% melebihi 100%. Perbaiki di halaman Kode Akun.` },
        { status: 400 }
      );
    }

    const jatah = hitungJatah(periode.labaBersih, berpersen);
    const label = labelPeriode(bln.tahun, bln.bulan);

    await prisma.$transaction(async (tx) => {
      await tx.distribusiAlokasi.createMany({
        data: jatah.map((j) => ({
          periodeId: periode.id,
          kodeAkunId: j.kodeAkunId,
          persen: j.persen,
          nominal: j.nominal,
          disetujuiOlehId: auth.user.id,
        })),
      });
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "DistribusiAlokasi",
          entitasId: periode.id,
          aksi: AksiAudit.BUAT,
          dataBaru: {
            periode: label,
            labaDasar: periode.labaBersih.toFixed(2),
            totalPersen: persenTotal.toString(),
            totalDibagikan: jatah.reduce((s, j) => s.plus(j.nominal), new Prisma.Decimal(0)).toFixed(2),
            jumlahKode: jatah.length,
          },
        },
      });
    });

    return NextResponse.json({ dibagikan: jatah.length });
  } catch (err) {
    return apiError(err);
  }
}

/** Batalkan distribusi yang sudah disahkan. Hanya OWNER; jatahnya hilang dari saldo alokasi. */
export async function DELETE(req: Request) {
  const auth = await wajibLogin(bolehBatalkanDistribusi);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const bln = bulanValid(sp.get("tahun"), sp.get("bulan"));
    if (!bln) return NextResponse.json({ error: "Tahun dan bulan tidak valid" }, { status: 400 });

    const periode = await prisma.periodeLaba.findUnique({
      where: { tahun_bulan: { tahun: bln.tahun, bulan: bln.bulan } },
      include: { distribusi: true },
    });
    if (!periode || periode.distribusi.length === 0) {
      return NextResponse.json({ error: "Bulan ini belum ada distribusi" }, { status: 404 });
    }

    const total = periode.distribusi.reduce((s, d) => s.plus(d.nominal), new Prisma.Decimal(0));
    await prisma.$transaction([
      prisma.distribusiAlokasi.deleteMany({ where: { periodeId: periode.id } }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "DistribusiAlokasi",
          entitasId: periode.id,
          aksi: AksiAudit.HAPUS,
          dataLama: {
            periode: labelPeriode(bln.tahun, bln.bulan),
            totalDibagikan: total.toFixed(2),
            jumlahKode: periode.distribusi.length,
          },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
