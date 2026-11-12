import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehPertumbuhanBisnis } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit } from "@/generated/prisma/enums";
import { hitungUlangPertumbuhanBrand } from "@/lib/pertumbuhan-bisnis";

/**
 * DELETE /api/pertumbuhan-bisnis/[id]
 * Hapus data rekap satu bulan.
 * Akses: Hanya FINANCE (ADMIN) dan OWNER.
 */
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await wajibLogin(bolehPertumbuhanBisnis, { semuaBrand: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.pertumbuhanBisnis.findUnique({
      where: { id },
      include: { brand: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Data rekap tidak ditemukan" }, { status: 404 });
    }

    const brandId = existing.brandId;
    await prisma.pertumbuhanBisnis.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        entitas: "PertumbuhanBisnis",
        entitasId: id,
        aksi: AksiAudit.HAPUS,
        dataLama: existing as any,
      },
    });

    // Hitung ulang sisa bulan
    await hitungUlangPertumbuhanBrand(brandId);

    return NextResponse.json({
      success: true,
      message: `Rekap ${existing.brand.nama} ${existing.tahun}-${existing.bulan} berhasil dihapus`,
    });
  } catch (err) {
    return apiError(err);
  }
}
