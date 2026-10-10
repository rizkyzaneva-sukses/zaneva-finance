import { NextResponse } from "next/server";
import { getPenggunaAktif, type PenggunaAktif } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

export function unauthorized() {
  return NextResponse.json({ error: "Belum login", type: "auth_required" }, { status: 401 });
}

export function forbidden(pesan = "Akses ditolak untuk role kamu") {
  return NextResponse.json({ error: pesan, type: "forbidden" }, { status: 403 });
}

/** Pesan yang aman ditampilkan. Detail Prisma, env, dan respons layanan luar tidak boleh ikut. */
export function pesanUntukKlien(error: unknown): string {
  const mentah = error instanceof Error ? error.message : "";
  const bocor =
    !mentah ||
    mentah.length > 240 ||
    mentah.includes("\n") ||
    /prisma|DATABASE_URL|SESSION_SECRET|OPENROUTER_API_KEY|node_modules|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|postgres(?:ql)?:\/\/|password authentication|^\s*at\s+|\(\S+:\d+:\d+\)|bearer\s+/i.test(
      mentah
    );
  return bocor ? "Terjadi kesalahan di server" : mentah;
}

export function apiError(error: unknown) {
  console.error("[api]", error);
  return NextResponse.json({ error: pesanUntukKlien(error), type: "server_error" }, { status: 500 });
}

type HasilAuth = { ok: true; user: PenggunaAktif } | { ok: false; response: NextResponse };

/**
 * Gerbang tunggal untuk route handler: pastikan sudah login, dan kalau `izin`
 * diisi, pastikan role-nya lolos. Dicek di server, bukan sekadar disembunyikan di UI.
 */
export async function wajibLogin(
  izin?: (role: Role) => boolean,
  opsi?: { semuaBrand?: boolean }
): Promise<HasilAuth> {
  const user = await getPenggunaAktif();
  if (!user) return { ok: false, response: unauthorized() };
  if (izin && !izin(user.role)) return { ok: false, response: forbidden() };
  // Fitur lintas brand (alokasi, stok opname, master produk, kode akun, brand) tidak bisa
  // dipotong per brand, jadi pengguna yang dibatasi ke brand tertentu ditolak di sini.
  if (opsi?.semuaBrand && user.brandIds !== null) {
    return { ok: false, response: forbidden("Fitur ini hanya untuk pengguna yang tidak dibatasi ke brand tertentu") };
  }
  return { ok: true, user };
}
