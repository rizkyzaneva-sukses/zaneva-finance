import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehLihatLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AksiAudit } from "@/generated/prisma/enums";

/** Log perubahan: siapa mengubah apa, kapan, dari nilai apa ke nilai apa. Hanya OWNER. */
export async function GET(req: Request) {
  const auth = await wajibLogin(bolehLihatLog);
  if (!auth.ok) return auth.response;

  try {
    const sp = new URL(req.url).searchParams;
    const halaman = Math.max(1, Number(sp.get("halaman")) || 1);
    const perHalaman = Math.min(100, Math.max(10, Number(sp.get("perHalaman")) || 50));

    const where: Prisma.AuditLogWhereInput = {};
    const entitas = sp.get("entitas");
    if (entitas) where.entitas = entitas;
    const aksi = sp.get("aksi");
    if (aksi && aksi in AksiAudit) where.aksi = aksi as AksiAudit;
    const userId = sp.get("userId");
    if (userId) where.userId = userId;

    const dari = sp.get("dari");
    const sampai = sp.get("sampai");
    if (dari || sampai) {
      where.createdAt = {};
      // Rentang inklusif sampai akhir hari, dalam WIB (UTC+7)
      if (dari) where.createdAt.gte = new Date(`${dari}T00:00:00+07:00`);
      if (sampai) where.createdAt.lte = new Date(`${sampai}T23:59:59.999+07:00`);
    }

    const [log, total, pengguna] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (halaman - 1) * perHalaman,
        take: perHalaman,
        include: { user: { select: { nama: true, username: true } } },
      }),
      prisma.auditLog.count({ where }),
      prisma.user.findMany({
        orderBy: { nama: "asc" },
        select: { id: true, nama: true, username: true },
      }),
    ]);

    // Label yang bisa dibaca manusia. Entitas yang sudah dihapus tidak ditemukan,
    // jadi dicari dari isi log-nya sendiri (penghapusan menyimpan data lamanya).
    const idPer = (nama: string) => [...new Set(log.filter((l) => l.entitas === nama).map((l) => l.entitasId))];
    const [transaksi, kode, rekening] = await Promise.all([
      prisma.transaksi.findMany({
        where: { id: { in: idPer("Transaksi") } },
        select: { id: true, keterangan: true, tanggal: true, rekening: { select: { nama: true } } },
      }),
      prisma.kodeAkun.findMany({
        where: { id: { in: idPer("KodeAkun") } },
        select: { id: true, kode: true, nama: true },
      }),
      prisma.rekening.findMany({
        where: { id: { in: idPer("Rekening") } },
        select: { id: true, nama: true },
      }),
    ]);
    const peta = new Map<string, string>();
    for (const t of transaksi) {
      peta.set(`Transaksi:${t.id}`, `${t.keterangan} (${t.rekening.nama}, ${t.tanggal.toISOString().slice(0, 10)})`);
    }
    for (const k of kode) peta.set(`KodeAkun:${k.id}`, `${k.kode} ${k.nama}`);
    for (const r of rekening) peta.set(`Rekening:${r.id}`, r.nama);

    const hasil = log.map((l) => {
      let label = peta.get(`${l.entitas}:${l.entitasId}`) ?? null;
      // Pengesahan laba & distribusi tidak punya nama sendiri; periodenya ada di isi log.
      if (!label && (l.entitas === "PeriodeLaba" || l.entitas === "DistribusiAlokasi")) {
        const d = (l.dataBaru ?? l.dataLama) as Record<string, unknown> | null;
        if (d && typeof d.periode === "string") label = `Periode ${d.periode}`;
      }
      if (!label && l.aksi === "HAPUS" && l.dataLama && typeof l.dataLama === "object") {
        const d = l.dataLama as Record<string, unknown>;
        label = [d.keterangan, d.nama].find((v) => typeof v === "string") as string | undefined ?? null;
        if (label) label += " (sudah dihapus)";
      }
      return { ...l, label };
    });

    return NextResponse.json({ log: hasil, total, halaman, perHalaman, pengguna });
  } catch (err) {
    return apiError(err);
  }
}
