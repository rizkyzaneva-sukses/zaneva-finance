import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatAlokasi } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { Kelompok } from "@/generated/prisma/enums";
import { netPerKodeAkun } from "@/lib/laporan";
import {
  bulanBerjalanWib,
  hariIniWib,
  hitungJatah,
  labaBulan,
  totalPersen,
} from "@/lib/alokasi";

const JUMLAH_BULAN = 6;

/** Saldo alokasi per kode + status tutup buku & distribusi tiap bulan. ADMIN/OWNER. */
export async function GET() {
  const auth = await wajibLogin(bolehLihatAlokasi);
  if (!auth.ok) return auth.response;

  try {
    // Semua kode yang relevan: kelompok Alokasi, atau yang punya persen / saldo awal / riwayat distribusi.
    const kodeList = await prisma.kodeAkun.findMany({
      where: {
        OR: [
          { kelompok: Kelompok.ALOKASI, aktif: true },
          { persenAlokasi: { not: null } },
          { saldoAwalAlokasi: { not: new Prisma.Decimal(0) } },
          { distribusi: { some: {} } },
        ],
      },
      orderBy: { kode: "asc" },
      select: {
        id: true,
        kode: true,
        nama: true,
        aktif: true,
        persenAlokasi: true,
        saldoAwalAlokasi: true,
      },
    });

    const [jatahPerKode, netPerKode] = await Promise.all([
      prisma.distribusiAlokasi.groupBy({ by: ["kodeAkunId"], _sum: { nominal: true } }),
      netPerKodeAkun(hariIniWib()),
    ]);
    const jatah = new Map(jatahPerKode.map((j) => [j.kodeAkunId, Number(j._sum.nominal ?? 0)]));

    const kode = kodeList.map((k) => {
      const saldoAwal = Number(k.saldoAwalAlokasi);
      const totalJatah = jatah.get(k.id) ?? 0;
      // net = masuk − keluar; uang keluar dengan kode ini adalah pemakaian alokasi.
      const net = netPerKode.get(k.id) ?? 0;
      const terpakai = -net;
      return {
        id: k.id,
        kode: k.kode,
        nama: k.nama,
        aktif: k.aktif,
        persen: k.persenAlokasi === null ? null : Number(k.persenAlokasi),
        saldoAwal,
        totalJatah,
        terpakai: Math.round(terpakai * 100) / 100,
        saldo: Math.round((saldoAwal + totalJatah - terpakai) * 100) / 100,
      };
    });

    // Bulan yang ditampilkan: beberapa bulan terakhir yang sudah berakhir,
    // ditambah bulan lama yang pernah disahkan supaya riwayat tidak hilang.
    const kini = bulanBerjalanWib();
    const bulanTampil = new Map<string, { tahun: number; bulan: number }>();
    for (let i = 1; i <= JUMLAH_BULAN; i++) {
      const idx = kini.tahun * 12 + (kini.bulan - 1) - i;
      const tahun = Math.floor(idx / 12);
      const bulan = (idx % 12) + 1;
      bulanTampil.set(`${tahun}-${bulan}`, { tahun, bulan });
    }
    const periodeAda = await prisma.periodeLaba.findMany({
      include: {
        disetujuiOleh: { select: { nama: true } },
        distribusi: {
          include: { kodeAkun: { select: { kode: true, nama: true } }, disetujuiOleh: { select: { nama: true } } },
          orderBy: { kodeAkun: { kode: "asc" } },
        },
      },
    });
    for (const p of periodeAda) bulanTampil.set(`${p.tahun}-${p.bulan}`, { tahun: p.tahun, bulan: p.bulan });
    const petaPeriode = new Map(periodeAda.map((p) => [`${p.tahun}-${p.bulan}`, p]));

    const kodeBerpersen = kodeList
      .filter((k) => k.aktif && k.persenAlokasi !== null && k.persenAlokasi.gt(0))
      .map((k) => ({ id: k.id, persen: k.persenAlokasi as Prisma.Decimal }));
    const namaKode = new Map(kodeList.map((k) => [k.id, { kode: k.kode, nama: k.nama }]));

    const urut = [...bulanTampil.values()].sort((a, b) => b.tahun * 12 + b.bulan - (a.tahun * 12 + a.bulan));
    const semuaPeriode = await Promise.all(
      urut.map(async ({ tahun, bulan }) => {
        const rec = petaPeriode.get(`${tahun}-${bulan}`);
        const live = await labaBulan(tahun, bulan);
        const disahkan = rec
          ? { id: rec.id, labaBersih: Number(rec.labaBersih), oleh: rec.disetujuiOleh.nama, pada: rec.disetujuiPada }
          : null;

        const sudahDibagi = rec && rec.distribusi.length > 0 ? rec.distribusi : null;
        // Pratinjau: dihitung dari laba yang DISAHKAN dengan persen saat ini — bukan dari laba live.
        const pratinjau =
          rec && !sudahDibagi
            ? hitungJatah(rec.labaBersih, kodeBerpersen).map((j) => ({
                kodeAkunId: j.kodeAkunId,
                kode: namaKode.get(j.kodeAkunId)?.kode ?? "",
                nama: namaKode.get(j.kodeAkunId)?.nama ?? "",
                persen: Number(j.persen),
                nominal: Number(j.nominal),
              }))
            : null;

        return {
          tahun,
          bulan,
          jumlahTransaksi: live.jumlahTransaksi,
          labaLive: live.laba,
          belumMasuk: live.belumMasuk,
          menungguAcc: live.menungguAcc,
          soBelumMenjangkau: live.soBelumMenjangkau,
          disahkan,
          // Laba berubah sejak disahkan: ada transaksi yang diubah/ditambah di bulan itu.
          berubah: disahkan ? Math.abs(disahkan.labaBersih - live.laba) >= 0.01 : false,
          distribusi: sudahDibagi
            ? {
                oleh: sudahDibagi[0].disetujuiOleh.nama,
                pada: sudahDibagi[0].disetujuiPada,
                total: Math.round(sudahDibagi.reduce((s, d) => s + Number(d.nominal), 0) * 100) / 100,
                item: sudahDibagi.map((d) => ({
                  kodeAkunId: d.kodeAkunId,
                  kode: d.kodeAkun.kode,
                  nama: d.kodeAkun.nama,
                  persen: Number(d.persen),
                  nominal: Number(d.nominal),
                })),
              }
            : null,
          pratinjau,
        };
      })
    );

    // Bulan tanpa satu pun transaksi dan belum pernah disahkan tidak ada gunanya
    // ditampilkan — tidak ada laba yang bisa disahkan.
    const periode = semuaPeriode.filter((p) => p.disahkan || p.jumlahTransaksi > 0);

    return NextResponse.json({
      kode,
      periode,
      totalPersen: Number(totalPersen(kodeBerpersen)),
      hariIni: hariIniWib(),
    });
  } catch (err) {
    return apiError(err);
  }
}
