import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, AktivitasKas, Kelompok, Laporan } from "@/generated/prisma/enums";
import { bacaPersenAlokasi } from "@/lib/split";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const lama = await prisma.kodeAkun.findUnique({ where: { id } });
    if (!lama) return NextResponse.json({ error: "Kode akun tidak ditemukan" }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Prisma.KodeAkunUpdateInput = {};

    if (typeof body.kode === "string" && body.kode.trim()) data.kode = body.kode.trim();
    if (typeof body.nama === "string" && body.nama.trim()) data.nama = body.nama.trim();
    if (Object.values(Kelompok).includes(body.kelompok)) data.kelompok = body.kelompok;
    // null dikirim eksplisit = kembalikan ke "belum diatur"
    if ("laporan" in body) {
      data.laporan = Object.values(Laporan).includes(body.laporan) ? body.laporan : null;
    }
    if ("aktivitasKas" in body) {
      data.aktivitasKas = Object.values(AktivitasKas).includes(body.aktivitasKas)
        ? body.aktivitasKas
        : null;
    }
    if ("persenAlokasi" in body) {
      const persen = bacaPersenAlokasi(body.persenAlokasi);
      if (!persen.ok) return NextResponse.json({ error: persen.error }, { status: 400 });
      data.persenAlokasi = persen.nilai;
    }
    if ("saldoAwalAlokasi" in body) {
      let nilai: Prisma.Decimal;
      try {
        nilai = new Prisma.Decimal(String(body.saldoAwalAlokasi ?? "0") || "0");
      } catch {
        return NextResponse.json({ error: "Saldo awal alokasi harus berupa angka" }, { status: 400 });
      }
      if (!nilai.isFinite() || nilai.decimalPlaces() > 2) {
        return NextResponse.json(
          { error: "Saldo awal alokasi harus angka, maksimal 2 angka di belakang koma" },
          { status: 400 }
        );
      }
      data.saldoAwalAlokasi = nilai;
    }
    if (typeof body.aktif === "boolean") {
      if (lama.sistem && !body.aktif) {
        return NextResponse.json(
          { error: `Kode ${lama.kode} dipakai sistem untuk baris saldo awal, tidak bisa dinonaktifkan` },
          { status: 409 }
        );
      }
      data.aktif = body.aktif;
    }

    const kodeAkun = await prisma.kodeAkun.update({ where: { id }, data });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        entitas: "KodeAkun",
        entitasId: id,
        aksi: AksiAudit.UBAH,
        dataLama: {
          kode: lama.kode,
          nama: lama.nama,
          laporan: lama.laporan,
          aktivitasKas: lama.aktivitasKas,
          persenAlokasi: lama.persenAlokasi?.toString() ?? null,
          saldoAwalAlokasi: lama.saldoAwalAlokasi.toFixed(2),
          aktif: lama.aktif,
        },
        dataBaru: {
          kode: kodeAkun.kode,
          nama: kodeAkun.nama,
          laporan: kodeAkun.laporan,
          aktivitasKas: kodeAkun.aktivitasKas,
          persenAlokasi: kodeAkun.persenAlokasi?.toString() ?? null,
          saldoAwalAlokasi: kodeAkun.saldoAwalAlokasi.toFixed(2),
          aktif: kodeAkun.aktif,
        },
      },
    });

    return NextResponse.json({ kodeAkun });
  } catch (err) {
    return apiError(err);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const kode = await prisma.kodeAkun.findUnique({
      where: { id },
      include: { _count: { select: { transaksi: true, rincian: true } } },
    });
    if (!kode) return NextResponse.json({ error: "Kode akun tidak ditemukan" }, { status: 404 });
    const dipakai = kode._count.transaksi + kode._count.rincian;

    if (kode.sistem) {
      return NextResponse.json(
        { error: `Kode ${kode.kode} dipakai sistem untuk baris saldo awal, tidak bisa dihapus` },
        { status: 409 }
      );
    }
    if (dipakai > 0) {
      return NextResponse.json(
        {
          error: `Kode ini dipakai ${dipakai} kali (transaksi atau rincian split), jadi tidak bisa dihapus. Nonaktifkan saja supaya data lama tetap utuh.`,
        },
        { status: 409 }
      );
    }

    await prisma.kodeAkun.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        entitas: "KodeAkun",
        entitasId: id,
        aksi: AksiAudit.HAPUS,
        dataLama: { kode: kode.kode, nama: kode.nama, kelompok: kode.kelompok },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
