import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehKelolaPengguna } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isiDummy, hapusDummy, resetData } from "@/lib/demo-data";

/**
 * Fitur OWNER: kelola data demo & reset seluruh data.
 *
 *   GET                      → status (jumlah data saat ini)
 *   POST { aksi: "isi" }     → buat data contoh untuk semua fitur & semua brand
 *   POST { aksi: "hapus" }   → hapus data contoh saja
 *   POST { aksi: "reset" }   → hapus SELURUH data operasional (butuh konfirmasi)
 *
 * Gerbang yang sama dengan kelola pengguna: hanya OWNER.
 */
export async function GET() {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const [brand, rekening, transaksi, produk, dokumen, stokOpname, periodeLaba, pengguna] = await Promise.all([
      prisma.brand.count(),
      prisma.rekening.count(),
      prisma.transaksi.count(),
      prisma.produk.count(),
      prisma.dokumenMutasi.count(),
      prisma.stokOpname.count(),
      prisma.periodeLaba.count(),
      prisma.user.count(),
    ]);
    return NextResponse.json({
      status: { brand, rekening, transaksi, produk, dokumen, stokOpname, periodeLaba, pengguna },
    });
  } catch (err) {
    return apiError(err);
  }
}

export async function POST(req: Request) {
  const auth = await wajibLogin(bolehKelolaPengguna);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json().catch(() => ({}));
    const aksi = String(body.aksi ?? "");
    const konfirmasi = String(body.konfirmasi ?? "");

    if (aksi === "isi") {
      const hasil = await isiDummy();
      return NextResponse.json({ ok: true, pesan: "Data contoh dibuat.", hasil });
    }

    if (aksi === "hapus") {
      const hasil = await hapusDummy();
      return NextResponse.json({ ok: true, pesan: "Data contoh dihapus.", hasil });
    }

    if (aksi === "reset") {
      // Gerbang tegas: harus mengetik RESET supaya tidak terhapus karena kesalahan klik.
      if (konfirmasi.trim().toUpperCase() !== "RESET") {
        return NextResponse.json(
          { error: 'Ketik "RESET" untuk konfirmasi penghapusan seluruh data.' },
          { status: 400 }
        );
      }
      const hasil = await resetData();
      return NextResponse.json({ ok: true, pesan: "Seluruh data operasional dihapus.", hasil });
    }

    return NextResponse.json({ error: "Aksi tidak dikenal" }, { status: 400 });
  } catch (err) {
    return apiError(err);
  }
}
