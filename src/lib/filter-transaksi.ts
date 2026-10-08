import { Prisma } from "@/generated/prisma/client";
import { StatusAcc, StatusKode } from "@/generated/prisma/enums";

/** Filter transaksi dari query string — dipakai bareng oleh list, export, dan dashboard. */
export function filterDariQuery(sp: URLSearchParams): Prisma.TransaksiWhereInput {
  const where: Prisma.TransaksiWhereInput = {};
  // Beberapa filter sama-sama butuh OR, jadi dikumpulkan di AND supaya tidak saling timpa.
  const dan: Prisma.TransaksiWhereInput[] = [];

  const rekeningId = sp.get("rekeningId");
  if (rekeningId) where.rekeningId = rekeningId;

  // Kode akun cocok kalau dipakai langsung di transaksi, ATAU di salah satu rincian split-nya.
  const kodeAkunId = sp.get("kodeAkunId");
  if (kodeAkunId) {
    dan.push({ OR: [{ kodeAkunId }, { rincian: { some: { kodeAkunId } } }] });
  }

  const status = sp.get("statusKode");
  if (status && status in StatusKode) where.statusKode = status as StatusKode;

  if (sp.get("belumBeres") === "1") {
    dan.push({
      OR: [
        { statusKode: StatusKode.KOSONG },
        { statusKode: StatusKode.SARAN_AI },
        { yakin: false },
      ],
    });
  }

  if (sp.get("menungguAcc") === "1") where.statusAcc = { in: [StatusAcc.MENUNGGU, StatusAcc.PERLU_FINANCE] };

  const dari = sp.get("dari");
  const sampai = sp.get("sampai");
  if (dari || sampai) {
    where.tanggal = {};
    if (dari) where.tanggal.gte = new Date(`${dari}T00:00:00.000Z`);
    if (sampai) where.tanggal.lte = new Date(`${sampai}T00:00:00.000Z`);
  }

  const cari = sp.get("cari")?.trim();
  if (cari) where.keterangan = { contains: cari, mode: "insensitive" };

  if (dan.length > 0) where.AND = dan;
  return where;
}
