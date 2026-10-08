import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehAccBendahara, bolehAccFinance } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit, StatusAcc } from "@/generated/prisma/enums";

/**
 * Sahkan transaksi yang menunggu ACC — alur berjenjang.
 *
 *   MENUNGGU       → DISETUJUI   (verifikasi BENDAHARA / Finance)
 *   PERLU_FINANCE  → DISETUJUI   (finalisasi FINANCE / ADMIN/OWNER)
 *
 * Tidak mengubah isi transaksi — kalau isinya salah, cukup dibetulkan lewat
 * edit biasa, yang otomatis mengesahkan. Tahap ditentukan otomatis dari status
 * transaksi yang dipilih: yang MENUNGGU diverifikasi dulu, yang PERLU_FINANCE
 * difinalkan. Tidak ada transaksi campur status dalam satu klik dari UI.
 */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehAccBendahara);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const ids: string[] = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : [];
    // Opsional: UI boleh memaksa tahap ("bendahara" | "finance"). Default: deteksi otomatis.
    const tahap = body.tahap === "finance" ? "finance" : body.tahap === "bendahara" ? "bendahara" : null;

    if (ids.length === 0) {
      return NextResponse.json({ error: "Tidak ada transaksi yang dipilih" }, { status: 400 });
    }
    if (ids.length > 500) {
      return NextResponse.json({ error: "Maksimal 500 transaksi sekali ACC" }, { status: 400 });
    }

    const hasil = await prisma.$transaction(async (tx) => {
      const dasar: (string | undefined)[] = [];
      const statusDiizinkan: StatusAcc[] =
        tahap === "finance"
          ? [StatusAcc.PERLU_FINANCE]
          : tahap === "bendahara"
            ? [StatusAcc.MENUNGGU]
            : [StatusAcc.MENUNGGU, StatusAcc.PERLU_FINANCE];

      const dipilih = await tx.transaksi.findMany({
        where: {
          id: { in: ids },
          statusAcc: { in: statusDiizinkan },
          // Pengguna yang dibatasi brand hanya bisa meng-ACC transaksi rekening brand-nya
          ...(auth.user.rekeningIds ? { rekeningId: { in: auth.user.rekeningIds } } : {}),
        },
        select: { id: true, statusAcc: true },
      });

      // Pemisahan per tahap supaya bendahara tidak bisa memfinalkan PERLU_FINANCE
      // saat mode otomatis, dan sebaliknya.
      const boleh = tahap === "finance"
        ? bolehAccFinance(auth.user.role)
        : tahap === "bendahara"
          ? bolehAccBendahara(auth.user.role)
          : true;

      const sasaran = dipilih.filter((t) => {
        if (t.statusAcc === StatusAcc.PERLU_FINANCE) return bolehAccFinance(auth.user.role);
        return bolehAccBendahara(auth.user.role);
      });
      const ditolak = dipilih.length - sasaran.length;

      if (sasaran.length === 0) {
        return { disahkan: 0, dilewati: ids.length - dipilih.length, ditolak, tanpaIzin: !boleh };
      }

      const sekarang = new Date();
      await tx.transaksi.updateMany({
        where: { id: { in: sasaran.map((m) => m.id) } },
        data: { statusAcc: StatusAcc.DISETUJUI, accOlehId: auth.user.id, accPada: sekarang },
      });
      await tx.auditLog.createMany({
        data: sasaran.map((m) => ({
          userId: auth.user.id,
          entitas: "Transaksi",
          entitasId: m.id,
          aksi: AksiAudit.UBAH,
          dataLama: { statusAcc: m.statusAcc },
          dataBaru: {
            statusAcc: StatusAcc.DISETUJUI,
            tahap: m.statusAcc === StatusAcc.PERLU_FINANCE ? "finance" : "bendahara",
          },
        })),
      });
      return { disahkan: sasaran.length, dilewati: ids.length - dipilih.length, ditolak, tanpaIzin: false };
    });

    return NextResponse.json({ ...hasil, diminta: ids.length });
  } catch (err) {
    return apiError(err);
  }
}
