import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Bank, Role, StatusKode, Sumber } from "@/generated/prisma/enums";
import { buatDedupeHash, hitungUlangSaldo, urutanInputBerikutnya } from "@/lib/rekap";
import { filterDariQuery } from "@/lib/filter-transaksi";
import { batasiTransaksi, bolehRekening } from "@/lib/akses";
import { fieldAccUntukInput } from "@/lib/acc";

export async function GET(req: Request) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const filter = filterDariQuery(sp);
    // BENDAHARA hanya melihat transaksi kas tunai (petty cash), bukan rekening bank.
    const where: Prisma.TransaksiWhereInput = batasiTransaksi(
      auth.user.role === Role.BENDAHARA
        ? { AND: [filter, { rekening: { bank: Bank.PETTY_CASH } }] }
        : filter,
      auth.user
    );
    const halaman = Math.max(1, Number(sp.get("halaman")) || 1);
    const perHalaman = Math.min(200, Math.max(10, Number(sp.get("perHalaman")) || 50));

    const [transaksi, total] = await Promise.all([
      prisma.transaksi.findMany({
        where,
        orderBy: [{ tanggal: "desc" }, { urutanInput: "desc" }],
        skip: (halaman - 1) * perHalaman,
        take: perHalaman,
        include: {
          rekening: { select: { id: true, nama: true, nomorRekening: true } },
          kodeAkun: { select: { id: true, kode: true, nama: true } },
          rincian: {
            orderBy: { urutan: "asc" },
            include: { kodeAkun: { select: { id: true, kode: true, nama: true } } },
          },
          createdBy: { select: { nama: true } },
          updatedBy: { select: { nama: true } },
          accOleh: { select: { nama: true } },
          diverifikasiOleh: { select: { nama: true } },
        },
      }),
      prisma.transaksi.count({ where }),
    ]);

    return NextResponse.json({ transaksi, total, halaman, perHalaman });
  } catch (err) {
    return apiError(err);
  }
}

/** Tambah satu transaksi manual — untuk penyesuaian yang tidak ada di mutasi bank. */
export async function POST(req: Request) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const rekeningId = String(body.rekeningId ?? "");
    const tanggalIso = String(body.tanggalIso ?? "");
    const keterangan = String(body.keterangan ?? "").trim();

    if (!rekeningId) return NextResponse.json({ error: "Rekening wajib dipilih" }, { status: 400 });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggalIso)) {
      return NextResponse.json({ error: "Tanggal wajib diisi" }, { status: 400 });
    }
    if (!keterangan) return NextResponse.json({ error: "Keterangan wajib diisi" }, { status: 400 });

    const uangMasuk = Number(body.uangMasuk) || 0;
    const uangKeluar = Number(body.uangKeluar) || 0;
    if (uangMasuk <= 0 && uangKeluar <= 0) {
      return NextResponse.json({ error: "Isi uang masuk atau uang keluar" }, { status: 400 });
    }
    if (uangMasuk > 0 && uangKeluar > 0) {
      return NextResponse.json(
        { error: "Satu baris hanya boleh uang masuk saja atau uang keluar saja" },
        { status: 400 }
      );
    }

    const rekening = await prisma.rekening.findUnique({ where: { id: rekeningId } });
    if (!rekening || !rekening.aktif) {
      return NextResponse.json({ error: "Rekening tidak ditemukan atau nonaktif" }, { status: 404 });
    }
    if (!bolehRekening(auth.user, rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    if (auth.user.role === Role.BENDAHARA && rekening.bank !== Bank.PETTY_CASH) {
      return NextResponse.json(
        { error: "Bendahara hanya boleh menginput ke rekening petty cash" },
        { status: 403 }
      );
    }

    const transaksi = await prisma.$transaction(async (tx) => {
      const dibuat = await tx.transaksi.create({
        data: {
          rekeningId,
          kodeAkunId: body.kodeAkunId || null,
          tanggal: new Date(`${tanggalIso}T00:00:00.000Z`),
          urutanInput: await urutanInputBerikutnya(tx, rekeningId),
          keterangan,
          uangMasuk: new Prisma.Decimal(uangMasuk),
          uangKeluar: new Prisma.Decimal(uangKeluar),
          saldo: new Prisma.Decimal(0),
          catatan: String(body.catatan ?? "").trim() || null,
          statusKode: body.kodeAkunId ? StatusKode.DIKONFIRMASI : StatusKode.KOSONG,
          sumber: Sumber.MANUAL,
          dedupeHash: buatDedupeHash({ tanggalIso, uangMasuk, uangKeluar, keterangan }),
          // Petty cash oleh bendahara/staff langsung DISETUJUI; sisanya ikut aturan role.
          ...fieldAccUntukInput(auth.user, rekening.bank),
          createdById: auth.user.id,
        },
      });
      await hitungUlangSaldo(tx, rekeningId);
      // Baca ulang: `dibuat` masih memuat saldo 0 dari sebelum hitung ulang.
      return tx.transaksi.findUniqueOrThrow({ where: { id: dibuat.id } });
    });

    return NextResponse.json({ transaksi });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "Transaksi yang sama persis sudah ada di rekening ini" },
        { status: 409 }
      );
    }
    return apiError(err);
  }
}
