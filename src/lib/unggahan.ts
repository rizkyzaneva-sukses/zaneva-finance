import { Prisma } from "@/generated/prisma/client";
import { AksiAudit, StatusAcc, Sumber } from "@/generated/prisma/enums";
import { fieldAccUntukPerubahan } from "@/lib/acc";
import type { PenggunaAktif } from "@/lib/auth";
import { buatDedupeHash, hitungUlangSaldo } from "@/lib/rekap";
import { tanggalKeIso } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

export function rapikanIds(nilai: unknown): string[] {
  if (!Array.isArray(nilai)) return [];
  const hasil: string[] = [];
  for (const item of nilai) {
    const id = typeof item === "string" ? item : "";
    if (id && !hasil.includes(id)) hasil.push(id);
  }
  return hasil;
}

export interface BarisKunci {
  id: string;
  batchId: string | null;
  createdById: string | null;
  createdAt: Date;
  sumber: string;
  tanggal: Date;
  createdBy: { nama: string } | null;
}

/** Sidik satu unggahan: batch baru, atau menit yang sama untuk data lama. */
export function kunciUnggahan(t: Pick<BarisKunci, "batchId" | "createdById" | "createdAt" | "sumber">): string {
  if (t.batchId) return `b|${t.batchId}`;
  const menit = t.createdAt.toISOString().slice(0, 16);
  return `l|${t.createdById ?? "-"}|${menit}|${t.sumber}`;
}

export function whereDariKunci(rekeningId: string, kunci: string): Prisma.TransaksiWhereInput | null {
  if (kunci.startsWith("b|")) {
    const batchId = kunci.slice(2);
    if (!batchId) return null;
    return { rekeningId, batchId };
  }
  if (!kunci.startsWith("l|")) return null;
  const sisa = kunci.slice(2);
  const pemisahMenit = sisa.indexOf("|");
  if (pemisahMenit < 0) return null;
  const userId = sisa.slice(0, pemisahMenit);
  const ekor = sisa.slice(pemisahMenit + 1);
  const pemisahSumber = ekor.lastIndexOf("|");
  if (pemisahSumber < 0) return null;
  const menit = ekor.slice(0, pemisahSumber);
  const sumber = ekor.slice(pemisahSumber + 1);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(menit)) return null;
  if (!Object.values(Sumber).includes(sumber as Sumber)) return null;
  const awal = new Date(`${menit}:00.000Z`);
  if (Number.isNaN(awal.getTime())) return null;
  return {
    rekeningId,
    batchId: null,
    sumber: sumber as Sumber,
    createdById: userId === "-" ? null : userId,
    createdAt: { gte: awal, lt: new Date(awal.getTime() + 60_000) },
  };
}

function hashBebas(terpakai: Set<string>, dasar: string, id: string): string {
  if (!terpakai.has(dasar)) {
    terpakai.add(dasar);
    return dasar;
  }
  const unik = `${dasar}:unik${id.slice(0, 8)}`;
  terpakai.add(unik);
  return unik;
}

/** Pindahkan transaksi ke rekening lain dan hitung ulang saldo keduanya. */
export async function pindahRekening(
  tx: Tx,
  ids: string[],
  rekeningTujuanId: string,
  userId: string
): Promise<number> {
  const rows = await tx.transaksi.findMany({
    where: { id: { in: ids } },
    select: { id: true, rekeningId: true, dedupeHash: true },
  });
  if (rows.length === 0) return 0;
  const asal = [...new Set(rows.map((r) => r.rekeningId))];
  const yangAda = await tx.transaksi.findMany({
    where: { rekeningId: rekeningTujuanId, NOT: { id: { in: rows.map((r) => r.id) } } },
    select: { dedupeHash: true },
  });
  const terpakai = new Set(yangAda.map((r) => r.dedupeHash));

  for (const r of rows) {
    if (r.rekeningId === rekeningTujuanId) continue;
    await tx.transaksi.update({
      where: { id: r.id },
      data: {
        rekeningId: rekeningTujuanId,
        dedupeHash: hashBebas(terpakai, r.dedupeHash, r.id),
        updatedById: userId,
        statusAcc: StatusAcc.DISETUJUI,
        accOlehId: userId,
        accPada: new Date(),
      },
    });
  }

  await tx.auditLog.create({
    data: {
      userId,
      entitas: "Transaksi",
      entitasId: rows[0].id,
      aksi: AksiAudit.UBAH,
      dataLama: { rekeningId: asal },
      dataBaru: { rekeningId: rekeningTujuanId, jumlah: rows.length, aksi: "pindah-rekening" },
    },
  });

  for (const id of asal) {
    if (id !== rekeningTujuanId) await hitungUlangSaldo(tx, id);
  }
  await hitungUlangSaldo(tx, rekeningTujuanId);
  return rows.length;
}

/** Tukar uang masuk dan uang keluar, lalu hitung ulang saldo. */
export async function balikArah(
  tx: Tx,
  ids: string[],
  user: Pick<PenggunaAktif, "id" | "role">
): Promise<{ diubah: number; perluAcc: boolean }> {
  const rows = await tx.transaksi.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      rekeningId: true,
      tanggal: true,
      keterangan: true,
      uangMasuk: true,
      uangKeluar: true,
      accOlehId: true,
      rekening: { select: { bank: true } },
    },
  });
  if (rows.length === 0) return { diubah: 0, perluAcc: false };

  const rekeningIds = [...new Set(rows.map((r) => r.rekeningId))];
  const yangAda = await tx.transaksi.findMany({
    where: { rekeningId: { in: rekeningIds }, NOT: { id: { in: rows.map((r) => r.id) } } },
    select: { rekeningId: true, dedupeHash: true },
  });
  const terpakai = new Map<string, Set<string>>();
  for (const r of yangAda) {
    const set = terpakai.get(r.rekeningId) ?? new Set<string>();
    set.add(r.dedupeHash);
    terpakai.set(r.rekeningId, set);
  }

  let perluAcc = false;
  for (const r of rows) {
    const masuk = r.uangKeluar;
    const keluar = r.uangMasuk;
    const dasar = buatDedupeHash({
      tanggalIso: tanggalKeIso(r.tanggal),
      uangMasuk: masuk,
      uangKeluar: keluar,
      keterangan: r.keterangan,
    });
    const set = terpakai.get(r.rekeningId) ?? new Set<string>();
    terpakai.set(r.rekeningId, set);
    const acc = fieldAccUntukPerubahan(user, r.rekening.bank, true, r.accOlehId);
    if (acc.statusAcc === StatusAcc.PERLU_FINANCE) perluAcc = true;
    await tx.transaksi.update({
      where: { id: r.id },
      data: {
        uangMasuk: masuk,
        uangKeluar: keluar,
        dedupeHash: hashBebas(set, dasar, r.id),
        updatedBy: { connect: { id: user.id } },
        ...acc,
      },
    });
  }

  await tx.auditLog.create({
    data: {
      userId: user.id,
      entitas: "Transaksi",
      entitasId: rows[0].id,
      aksi: AksiAudit.UBAH,
      dataBaru: { jumlah: rows.length, aksi: "balik-arah" },
    },
  });

  for (const id of rekeningIds) await hitungUlangSaldo(tx, id);
  return { diubah: rows.length, perluAcc };
}
