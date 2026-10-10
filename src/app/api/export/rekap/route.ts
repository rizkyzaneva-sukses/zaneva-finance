import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildRekapWorkbook, type BarisRekapExcel } from "@/lib/excel";
import { filterDariQuery } from "@/lib/filter-transaksi";
import { batasiTransaksi, bolehRekening } from "@/lib/akses";
import { formatAngka, labelRekening, tanggalKeIso } from "@/lib/utils";

export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLaporan);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const rekeningId = sp.get("rekeningId");
    if (rekeningId && !bolehRekening(auth.user, rekeningId)) {
      return NextResponse.json({ error: "Rekening ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    const where = batasiTransaksi(filterDariQuery(sp), auth.user);

    const transaksi = await prisma.transaksi.findMany({
      where,
      orderBy: [{ tanggal: "asc" }, { urutanInput: "asc" }],
      include: {
        rekening: { select: { nama: true } },
        kodeAkun: { select: { kode: true } },
        rincian: {
          orderBy: { urutan: "asc" },
          include: { kodeAkun: { select: { kode: true, nama: true } } },
        },
      },
    });

    if (transaksi.length === 0) {
      return NextResponse.json({ error: "Tidak ada transaksi untuk diexport" }, { status: 400 });
    }

    const rekening = rekeningId
      ? await prisma.rekening.findUnique({ where: { id: rekeningId } })
      : null;

    // Baris saldo awal hanya relevan kalau export-nya satu rekening dan
    // rentangnya memang dimulai dari awal pembukuan rekening itu.
    const dari = sp.get("dari");
    const sertakanSaldoAwal =
      rekening !== null && (!dari || dari <= tanggalKeIso(rekening.tanggalSaldoAwal));

    // Transaksi yang di-split tampil sebagai baris-baris rinciannya. Transaksi
    // aslinya dari bank masuk ke kolom Catatan, dan saldo berjalan turun/naik
    // per rincian sehingga baris terakhir tetap berakhir di saldo bank.
    const rows: BarisRekapExcel[] = transaksi.flatMap((t): BarisRekapExcel[] => {
      if (t.rincian.length === 0) {
        return [
          {
            tanggal: t.tanggal,
            kode: t.kodeAkun?.kode ?? "",
            keterangan: t.keterangan,
            uangMasuk: Number(t.uangMasuk),
            uangKeluar: Number(t.uangKeluar),
            saldo: Number(t.saldo),
            catatan: t.catatan ?? "",
            yakin: t.yakin,
          },
        ];
      }

      const masuk = t.uangMasuk.gt(0);
      const total = masuk ? t.uangMasuk : t.uangKeluar;
      const asli = `Split dari: ${t.keterangan} (${formatAngka(total.toFixed(2))})`;
      let berjalan = t.saldo.minus(t.uangMasuk).plus(t.uangKeluar);

      return t.rincian.map((r) => {
        berjalan = masuk ? berjalan.plus(r.nominal) : berjalan.minus(r.nominal);
        return {
          tanggal: t.tanggal,
          kode: r.kodeAkun.kode,
          keterangan: r.keterangan ?? r.kodeAkun.nama,
          uangMasuk: masuk ? Number(r.nominal) : 0,
          uangKeluar: masuk ? 0 : Number(r.nominal),
          saldo: Number(berjalan),
          catatan: t.catatan ? `${asli} — ${t.catatan}` : asli,
          yakin: t.yakin,
        };
      });
    });

    const namaRekening = rekening ? labelRekening(rekening.nama, rekening.nomorRekening) : "Semua Rekening";
    const buf = await buildRekapWorkbook(rows, {
      namaRekening,
      saldoAwal:
        sertakanSaldoAwal && rekening
          ? { tanggal: rekening.tanggalSaldoAwal, nominal: Number(rekening.saldoAwal) }
          : undefined,
    });

    const periode = dari && sp.get("sampai") ? `${dari}_sd_${sp.get("sampai")}` : tanggalKeIso(new Date());
    const namaFile = `Rekap_${namaRekening.replace(/[^\w-]+/g, "_")}_${periode}.xlsx`;

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
