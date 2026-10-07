import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelola, bolehRekap } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AksiAudit } from "@/generated/prisma/enums";
import { bacaFile, ekstensiDariTipe, hapusFileDisk } from "@/lib/dokumen";
import { bolehRekening } from "@/lib/akses";

type Params = { params: Promise<{ id: string }> };

/** Unduh file asli. Sudah dihapus otomatis → 410, bukan error server. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehRekap);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const d = await prisma.dokumenMutasi.findUnique({ where: { id } });
    if (!d) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    if (!bolehRekening(auth.user, d.rekeningId)) {
      return NextResponse.json({ error: "Dokumen ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    if (d.fileDihapusPada) {
      return NextResponse.json(
        { error: "File sudah dihapus otomatis setelah masa simpan. Unduh ulang mutasinya dari bank." },
        { status: 410 }
      );
    }

    const isi = await bacaFile(d.id, ekstensiDariTipe(d.tipe)).catch(() => null);
    if (!isi) {
      return NextResponse.json({ error: "File tidak ditemukan di penyimpanan" }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(isi), {
      headers: {
        "Content-Type": d.tipe,
        // filename* (RFC 5987) supaya nama berspasi/ber-aksara non-ASCII tidak merusak header
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(d.namaFile)}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return apiError(err);
  }
}

/** Hapus file lebih awal dari jadwal. Catatannya tetap tersimpan. Hanya ADMIN/OWNER. */
export async function DELETE(_req: Request, { params }: Params) {
  const auth = await wajibLogin(bolehKelola);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const d = await prisma.dokumenMutasi.findUnique({
      where: { id },
      include: { rekening: { select: { nama: true } } },
    });
    if (!d) return NextResponse.json({ error: "Dokumen tidak ditemukan" }, { status: 404 });
    if (!bolehRekening(auth.user, d.rekeningId)) {
      return NextResponse.json({ error: "Dokumen ini di luar brand yang ditugaskan ke kamu" }, { status: 403 });
    }
    if (d.fileDihapusPada) {
      return NextResponse.json({ error: "File ini sudah dihapus sebelumnya" }, { status: 409 });
    }

    await hapusFileDisk(d.id, ekstensiDariTipe(d.tipe));
    await prisma.$transaction([
      prisma.dokumenMutasi.update({ where: { id }, data: { fileDihapusPada: new Date() } }),
      prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          entitas: "DokumenMutasi",
          entitasId: id,
          aksi: AksiAudit.HAPUS,
          dataLama: { namaFile: d.namaFile, rekening: d.rekening.nama, periode: d.periode },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
