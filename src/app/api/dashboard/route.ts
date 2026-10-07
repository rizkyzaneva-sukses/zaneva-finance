import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLaporan } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { StatusKode } from "@/generated/prisma/enums";
import { filterDariQuery } from "@/lib/filter-transaksi";
import { saldoMeleset } from "@/lib/rekap";

export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLaporan);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const where = filterDariQuery(sp);

    const [rekeningAktif, agregat, perKode, rincianRows, belumBeres, semuaDalamFilter, menungguAcc] = await Promise.all([
      prisma.rekening.findMany({
        where: { aktif: true },
        orderBy: [{ urutan: "asc" }, { nama: "asc" }],
        select: { id: true, nama: true, bank: true, saldoAwal: true },
      }),
      prisma.transaksi.aggregate({
        where,
        _sum: { uangMasuk: true, uangKeluar: true },
        _count: true,
      }),
      // Transaksi yang di-split dikeluarkan di sini: nominalnya dihitung lewat rincian di bawah.
      prisma.transaksi.groupBy({
        by: ["kodeAkunId"],
        where: { ...where, rincian: { none: {} } },
        _sum: { uangMasuk: true, uangKeluar: true },
        _count: true,
      }),
      prisma.transaksiRincian.findMany({
        where: { transaksi: where },
        select: {
          kodeAkunId: true,
          nominal: true,
          transaksi: { select: { uangMasuk: true } },
        },
      }),
      prisma.transaksi.count({
        where: {
          ...where,
          OR: [
            { statusKode: StatusKode.KOSONG },
            { statusKode: StatusKode.SARAN_AI },
            { yakin: false },
          ],
        },
      }),
      prisma.transaksi.findMany({
        where,
        select: { tanggal: true, uangMasuk: true, uangKeluar: true },
        orderBy: { tanggal: "asc" },
      }),
      // Antrean ACC: transaksi hasil kerja STAFF/BENDAHARA yang belum disahkan
      prisma.transaksi.count({ where: { ...where, statusAcc: "MENUNGGU" } }),
    ]);

    // Saldo & status rekonsiliasi tiap rekening: ambil transaksi terakhirnya.
    const kartuRekening = await Promise.all(
      rekeningAktif.map(async (r) => {
        const terakhir = await prisma.transaksi.findFirst({
          where: { rekeningId: r.id },
          orderBy: [{ tanggal: "desc" }, { urutanInput: "desc" }],
          select: { saldo: true, saldoBank: true, tanggal: true },
        });
        const adaSelisih = await prisma.transaksi.count({
          where: { rekeningId: r.id, saldoBank: { not: null } },
        });
        return {
          id: r.id,
          nama: r.nama,
          bank: r.bank,
          saldo: Number(terakhir?.saldo ?? r.saldoAwal),
          tanggalTerakhir: terakhir?.tanggal ?? null,
          perluCek: terakhir ? saldoMeleset(terakhir.saldo, terakhir.saldoBank) : false,
          punyaSaldoBank: adaSelisih > 0,
        };
      })
    );

    // Tren bulanan dihitung di memori — jumlah baris per filter masih wajar,
    // dan ini menghindari SQL mentah yang berbeda antar database.
    const perBulanMap = new Map<string, { masuk: number; keluar: number }>();
    for (const t of semuaDalamFilter) {
      const kunci = t.tanggal.toISOString().slice(0, 7);
      const now = perBulanMap.get(kunci) ?? { masuk: 0, keluar: 0 };
      now.masuk += Number(t.uangMasuk);
      now.keluar += Number(t.uangKeluar);
      perBulanMap.set(kunci, now);
    }
    const perBulan = [...perBulanMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bulan, v]) => ({ bulan, ...v, net: v.masuk - v.keluar }));

    // Gabungkan transaksi biasa dengan rincian split per kode akun.
    // Arah rincian mengikuti induknya: induk uang masuk → rincian masuk, selain itu keluar.
    const gabung = new Map<
      string | null,
      { masuk: number; keluar: number; jumlah: number }
    >();
    const tambah = (kodeAkunId: string | null, masuk: number, keluar: number, jumlah: number) => {
      const now = gabung.get(kodeAkunId) ?? { masuk: 0, keluar: 0, jumlah: 0 };
      now.masuk += masuk;
      now.keluar += keluar;
      now.jumlah += jumlah;
      gabung.set(kodeAkunId, now);
    };
    for (const p of perKode) {
      tambah(p.kodeAkunId, Number(p._sum.uangMasuk ?? 0), Number(p._sum.uangKeluar ?? 0), p._count);
    }
    for (const r of rincianRows) {
      const nominal = Number(r.nominal);
      const masuk = r.transaksi.uangMasuk.gt(0);
      tambah(r.kodeAkunId, masuk ? nominal : 0, masuk ? 0 : nominal, 1);
    }

    const kodeDipakai = await prisma.kodeAkun.findMany({
      where: { id: { in: [...gabung.keys()].filter((v): v is string => v !== null) } },
      select: { id: true, kode: true, nama: true, kelompok: true },
    });
    const petaKode = new Map(kodeDipakai.map((k) => [k.id, k]));

    const breakdown = [...gabung.entries()]
      .map(([kodeAkunId, v]) => {
        const akun = kodeAkunId ? petaKode.get(kodeAkunId) : undefined;
        return {
          kodeAkunId,
          kode: akun?.kode ?? "(tanpa kode)",
          nama: akun?.nama ?? "Belum diberi kode akun",
          kelompok: akun?.kelompok ?? null,
          jumlahTransaksi: v.jumlah,
          masuk: v.masuk,
          keluar: v.keluar,
          /**
           * Net, bukan masuk + keluar. Menjumlah kedua arah menggandakan akun
           * dua arah: Pengalihan Dana yang masuk 40jt dan keluar 40jt akan
           * terlihat "80jt", padahal yang berpindah 40jt dan efeknya nol.
           */
          net: Math.round((v.masuk - v.keluar) * 100) / 100,
        };
      })
      .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

    return NextResponse.json({
      kartuRekening,
      ringkasan: {
        totalMasuk: Number(agregat._sum.uangMasuk ?? 0),
        totalKeluar: Number(agregat._sum.uangKeluar ?? 0),
        net: Number(agregat._sum.uangMasuk ?? 0) - Number(agregat._sum.uangKeluar ?? 0),
        jumlahTransaksi: agregat._count,
      },
      perBulan,
      breakdown,
      belumBeres,
      menungguAcc,
    });
  } catch (err) {
    return apiError(err);
  }
}
