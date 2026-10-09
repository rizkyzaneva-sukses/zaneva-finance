import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { kunciBelajar, pengecualianKode400 } from "@/lib/mutasi-pola";

type Db = Prisma.TransactionClient | typeof prisma;

export interface ContohPrompt {
  arah: "masuk" | "keluar";
  kunci: string;
  kode: string;
}

/** Koreksi yang sudah disimpan, kunci = "arah|sidik jari keterangan". */
export async function muatPetaContoh(): Promise<Map<string, { kode: string; kodeAkunId: string }>> {
  const rows = await prisma.contohKlasifikasi.findMany({
    include: { kodeAkun: { select: { id: true, kode: true, aktif: true } } },
  });
  const peta = new Map<string, { kode: string; kodeAkunId: string }>();
  for (const r of rows) {
    if (!r.kodeAkun.aktif) continue;
    peta.set(`${r.arah}|${r.kunci}`, { kode: r.kodeAkun.kode, kodeAkunId: r.kodeAkun.id });
  }
  return peta;
}

/**
 * Contoh untuk prompt AI. Transfer masuk kode 400 tidak ikut — itu sudah aturan tetap,
 * bukan sesuatu yang perlu diajarkan ulang ke model.
 */
export async function muatContohUntukPrompt(): Promise<ContohPrompt[]> {
  const rows = await prisma.contohKlasifikasi.findMany({
    where: { NOT: { AND: [{ arah: "masuk" }, { kodeAkun: { kode: "400" } }] } },
    orderBy: [{ jumlah: "desc" }, { terakhirPada: "desc" }],
    take: 30,
    include: { kodeAkun: { select: { kode: true, aktif: true } } },
  });
  return rows
    .filter((r) => r.kodeAkun.aktif)
    .map((r) => ({
      arah: r.arah === "keluar" ? "keluar" : "masuk",
      kunci: r.kunci,
      kode: r.kodeAkun.kode,
    }));
}

/**
 * Ingat pilihan kode tim. Transfer masuk biasa yang tetap 400 tidak disimpan
 * (aturan sudah menutupinya). Kalau dikembalikan ke 400, ingatan lama dihapus.
 */
export async function catatContoh(
  db: Db,
  items: { keterangan: string; arah: "masuk" | "keluar"; kode: string; kodeAkunId: string }[]
): Promise<void> {
  for (const item of items) {
    const kunci = kunciBelajar(item.keterangan);
    if (!kunci) continue;
    const standar400 =
      item.arah === "masuk" && item.kode === "400" && !pengecualianKode400(item.keterangan);
    if (standar400) {
      await db.contohKlasifikasi.deleteMany({ where: { kunci, arah: item.arah } });
      continue;
    }
    await db.contohKlasifikasi.upsert({
      where: { kunci_arah: { kunci, arah: item.arah } },
      create: { kunci, arah: item.arah, kodeAkunId: item.kodeAkunId, jumlah: 1 },
      update: {
        kodeAkunId: item.kodeAkunId,
        jumlah: { increment: 1 },
        terakhirPada: new Date(),
      },
    });
  }
}
