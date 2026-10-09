import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { bolehAksesRekening, fieldAccUntukPerubahan } from "@/lib/acc";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, StatusKode } from "@/generated/prisma/enums";
import { hitungUlangSaldo } from "@/lib/rekap";
import { bolehRekening } from "@/lib/akses";
import { catatContoh } from "@/lib/contoh-klasifikasi";
import { KODE_PENJUALAN } from "@/lib/mutasi-pola";

type Params = { params: Promise<{ id: string }> };

/**
 * Koreksi kode akun & catatan. Nominal/tanggal sengaja tidak bisa diubah di sini.
 * Perubahan oleh STAFF/BENDAHARA menandai transaksi "menunggu ACC".
 */
export async function PATCH(req: Request, { params }: Params) {
  const auth = await wajibLogin();
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const lama = await prisma.transaksi.findUnique({
      where: { id },
      include: {
        kodeAkun: { select: { kode: true } },
        rekening: { select: { bank: true } },
        _count: { select: { rincian: true } },
      },
    });
    if (!lama) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    if (!bolehRekening(auth.user, lama.rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    if (!bolehAksesRekening(auth.user.role, lama.rekening.bank)) {
      return NextResponse.json({ error: "Akses ditolak untuk rekening ini" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    // Koreksi kode akun / catatan dianggap menyentuh hal penting → wajib ACC finance.
    // Koreksi biasa (mis. `yakin`) cukup diverifikasi bendahara.
    const sentuhPenting = "kodeAkunId" in body || "catatan" in body;
    const data: Prisma.TransaksiUpdateInput = {
      updatedBy: { connect: { id: auth.user.id } },
      ...fieldAccUntukPerubahan(auth.user, sentuhPenting),
    };

    if ("kodeAkunId" in body && lama._count.rincian > 0) {
      return NextResponse.json(
        { error: "Transaksi ini di-split. Ubah kode lewat rinciannya, atau batalkan split dulu." },
        { status: 409 }
      );
    }

    let kodeBaru: { id: string; kode: string } | null = null;
    if ("kodeAkunId" in body) {
      const kodeAkunId = body.kodeAkunId ? String(body.kodeAkunId) : null;
      data.kodeAkun = kodeAkunId ? { connect: { id: kodeAkunId } } : { disconnect: true };
      // Sentuhan manusia selalu dianggap keputusan final, bukan saran mesin lagi.
      data.statusKode = kodeAkunId ? StatusKode.DIKONFIRMASI : StatusKode.KOSONG;
      if (kodeAkunId) {
        kodeBaru = await prisma.kodeAkun.findUnique({
          where: { id: kodeAkunId },
          select: { id: true, kode: true },
        });
      }
      // Bukan penjualan 400 lagi — status Verified tidak berlaku.
      if (kodeBaru?.kode !== KODE_PENJUALAN && lama.diverifikasiPada) {
        data.diverifikasiPada = null;
        if (lama.diverifikasiOlehId) data.diverifikasiOleh = { disconnect: true };
      }
    }
    if ("catatan" in body) data.catatan = String(body.catatan ?? "").trim() || null;
    if (typeof body.yakin === "boolean") data.yakin = body.yakin;

    const transaksi = await prisma.transaksi.update({
      where: { id },
      data,
      include: {
        kodeAkun: { select: { id: true, kode: true, nama: true } },
        diverifikasiOleh: { select: { nama: true } },
      },
    });

    if (kodeBaru) {
      await catatContoh(prisma, [
        {
          keterangan: lama.keterangan,
          arah: lama.uangMasuk.greaterThan(0) ? "masuk" : "keluar",
          kode: kodeBaru.kode,
          kodeAkunId: kodeBaru.id,
        },
      ]);
    }

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        entitas: "Transaksi",
        entitasId: id,
        aksi: AksiAudit.UBAH,
        dataLama: {
          kode: lama.kodeAkun?.kode ?? null,
          catatan: lama.catatan,
          statusKode: lama.statusKode,
          statusAcc: lama.statusAcc,
        },
        dataBaru: {
          kode: transaksi.kodeAkun?.kode ?? null,
          catatan: transaksi.catatan,
          statusKode: transaksi.statusKode,
          statusAcc: transaksi.statusAcc,
        },
      },
    });

    return NextResponse.json({ transaksi });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const lama = await prisma.transaksi.findUnique({
      where: { id },
      include: { kodeAkun: { select: { kode: true } } },
    });
    if (!lama) return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 });
    if (!bolehRekening(auth.user, lama.rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.transaksi.delete({ where: { id } });
      await hitungUlangSaldo(tx, lama.rekeningId);
      // Isi baris disimpan di audit log karena setelah ini datanya hilang permanen.
      await tx.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "Transaksi",
          entitasId: id,
          aksi: AksiAudit.HAPUS,
          dataLama: {
            tanggal: lama.tanggal.toISOString().slice(0, 10),
            keterangan: lama.keterangan,
            kode: lama.kodeAkun?.kode ?? null,
            uangMasuk: lama.uangMasuk.toFixed(2),
            uangKeluar: lama.uangKeluar.toFixed(2),
          },
        },
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
