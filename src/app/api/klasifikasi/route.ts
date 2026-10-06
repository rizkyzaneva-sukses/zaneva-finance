import { NextResponse } from "next/server";
import { wajibLogin, apiError } from "@/lib/api-helpers";
import { bolehInput } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sarankanKodeAkun } from "@/lib/openrouter";

interface BodyMasuk {
  baris?: { keterangan?: string; uangMasuk?: number; uangKeluar?: number }[];
}

/** Tahap 2: sarankan kode akun untuk baris hasil parsing. Teks saja, tanpa gambar. */
export async function POST(req: Request) {
  const auth = await wajibLogin(bolehInput);
  if (!auth.ok) return auth.response;

  try {
    const { baris }: BodyMasuk = await req.json().catch(() => ({}));
    if (!Array.isArray(baris) || baris.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris untuk diklasifikasi" }, { status: 400 });
    }

    const daftarKode = await prisma.kodeAkun.findMany({
      where: { aktif: true, sistem: false },
      orderBy: { urutan: "asc" },
      select: { id: true, kode: true, nama: true },
    });

    const saran = await sarankanKodeAkun(
      baris.map((b, index) => ({
        index,
        teks: String(b.keterangan ?? ""),
        arah: Number(b.uangMasuk ?? 0) > 0 ? ("masuk" as const) : ("keluar" as const),
      })),
      daftarKode
    );

    const byKode = new Map(daftarKode.map((k) => [k.kode, k]));
    const hasil = baris.map((_, index) => {
      const kode = saran.get(index);
      const akun = kode ? byKode.get(kode) : undefined;
      return akun
        ? { kodeAkunId: akun.id, kode: akun.kode, statusKode: "SARAN_AI" as const }
        : { kodeAkunId: null, kode: null, statusKode: "KOSONG" as const };
    });

    return NextResponse.json({ hasil });
  } catch (err) {
    return apiError(err);
  }
}
