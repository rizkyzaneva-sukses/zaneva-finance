import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  buildRekapWorkbook,
  buildRekapWorkbookMulti,
  namaSheetAman,
  type BarisRekapExcel,
} from "@/lib/excel";
import { filterDariQuery } from "@/lib/filter-transaksi";
import { batasiTransaksi, bolehRekening } from "@/lib/akses";
import { barisDariTransaksi } from "@/lib/ekspor-rekap";
import { labelRekening, tanggalKeIso } from "@/lib/utils";

/**
 * Export rekap ke Excel.
 *
 * Tiga mode, dipilih dari query string:
 *   1. tanpa `rekeningId`   → SATU sheet gabungan semua rekening
 *   2. `rekeningId=abc`     → satu sheet rekening itu, lengkap dengan saldo awal
 *   3. `rekeningId=a&rekeningId=b` (atau `rekeningIds=a,b`)
 *                           → SATU SHEET PER REKENING dalam satu file, plus sheet
 *                             Ringkasan berisi total masuk/keluar/saldo akhir
 *
 * `dari` / `sampai` (YYYY-MM-DD) memotong rentang tanggal dan berlaku di semua mode.
 */

const INCLUDE = {
  rekening: { select: { nama: true } },
  kodeAkun: { select: { kode: true } },
  rincian: {
    orderBy: { urutan: "asc" as const },
    include: { kodeAkun: { select: { kode: true, nama: true } } },
  },
};

/** Kumpulkan id rekening dari semua bentuk parameter yang didukung. */
function rekeningDiminta(sp: URLSearchParams): string[] {
  const semua = [
    ...sp.getAll("rekeningId"),
    ...sp.getAll("rekeningIds").flatMap((v) => v.split(",")),
  ]
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set(semua));
}

function namaFileAman(teks: string): string {
  return teks.replace(/[^\w-]+/g, "_").replace(/^_+|_+$/g, "") || "Rekap";
}

export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLaporan);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const diminta = rekeningDiminta(sp);

    // Setiap rekening yang diminta harus di dalam wewenang pengguna.
    for (const id of diminta) {
      if (!bolehRekening(auth.user, id)) {
        return NextResponse.json(
          { error: "Rekening ini di luar brand yang ditugaskan ke kamu" },
          { status: 403 }
        );
      }
    }

    const dari = sp.get("dari");
    const sampai = sp.get("sampai");
    if (dari && sampai && dari > sampai) {
      return NextResponse.json(
        { error: "Tanggal awal tidak boleh setelah tanggal akhir" },
        { status: 400 }
      );
    }

    // `filterDariQuery` hanya membaca SATU `rekeningId`. Pada mode multi-rekening
    // nilai itu akan mengunci hasil ke rekening pertama saja (sheet rekening lain
    // jadi kosong), jadi parameter rekening dibuang dulu lalu dipasang ulang di
    // bawah sesuai jumlah rekening yang diminta.
    const spFilter = new URLSearchParams(sp);
    spFilter.delete("rekeningId");
    spFilter.delete("rekeningIds");

    let where = batasiTransaksi(filterDariQuery(spFilter), auth.user);
    if (diminta.length === 1) {
      where = batasiTransaksi({ ...where, rekeningId: diminta[0] }, auth.user);
    } else if (diminta.length > 1) {
      const dan = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
      where = { ...where, AND: [...dan, { rekeningId: { in: diminta } }] };
      where = batasiTransaksi(where, auth.user);
    }

    const transaksi = await prisma.transaksi.findMany({
      where,
      orderBy: [{ tanggal: "asc" }, { urutanInput: "asc" }],
      include: INCLUDE,
    });

    if (transaksi.length === 0 && diminta.length === 0) {
      return NextResponse.json({ error: "Tidak ada transaksi untuk diexport" }, { status: 400 });
    }

    const periode = dari && sampai ? `${dari}_sd_${sampai}` : tanggalKeIso(new Date());

    // ── Mode 3: satu sheet per rekening + ringkasan ─────────────────────────
    if (diminta.length > 1) {
      const rekening = await prisma.rekening.findMany({ where: { id: { in: diminta } } });
      const urut = new Map(diminta.map((id, i) => [id, i]));
      rekening.sort((a, b) => (urut.get(a.id) ?? 0) - (urut.get(b.id) ?? 0));

      if (rekening.length === 0) {
        return NextResponse.json({ error: "Rekening tidak ditemukan" }, { status: 404 });
      }

      const perRekening = rekening.map((r) => {
        const milik = transaksi.filter((t) => t.rekeningId === r.id);
        const sertakanSaldoAwal = !dari || dari <= tanggalKeIso(r.tanggalSaldoAwal);
        return {
          namaSheet: namaSheetAman(labelRekening(r.nama, r.nomorRekening)),
          label: labelRekening(r.nama, r.nomorRekening),
          baris: barisDariTransaksi(milik),
          saldoAwal: sertakanSaldoAwal
            ? { tanggal: r.tanggalSaldoAwal, nominal: Number(r.saldoAwal) }
            : undefined,
        };
      });

      // Rekening yang diminta tapi tidak ada mutasi pada rentang ini tetap dapat
      // sheet kosong — staff perlu bukti "memang tidak ada transaksi", bukan file
      // yang diam-diam kehilangan satu rekening.
      const buf = await buildRekapWorkbookMulti(perRekening, { dari, sampai });
      const namaFile = `Rekap_${perRekening.length}_Rekening_${periode}.xlsx`;

      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${namaFile}"`,
        },
      });
    }

    // ── Mode 1 & 2: satu sheet ─────────────────────────────────────────────
    const rekeningId = diminta[0] ?? null;
    const rekening = rekeningId
      ? await prisma.rekening.findUnique({ where: { id: rekeningId } })
      : null;

    const sertakanSaldoAwal =
      rekening !== null && (!dari || dari <= tanggalKeIso(rekening.tanggalSaldoAwal));

    const rows: BarisRekapExcel[] = barisDariTransaksi(transaksi);
    const namaRekening = rekening
      ? labelRekening(rekening.nama, rekening.nomorRekening)
      : "Semua Rekening";

    const buf = await buildRekapWorkbook(rows, {
      namaRekening,
      saldoAwal:
        sertakanSaldoAwal && rekening
          ? { tanggal: rekening.tanggalSaldoAwal, nominal: Number(rekening.saldoAwal) }
          : undefined,
    });

    const namaFile = `Rekap_${namaFileAman(namaRekening)}_${periode}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${namaFile}"`,
      },
    });
  } catch (err) {
    return apiError(err);
  }
}
