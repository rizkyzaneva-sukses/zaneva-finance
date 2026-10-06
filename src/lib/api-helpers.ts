import { NextResponse } from "next/server";
import { getPenggunaAktif, type PenggunaAktif } from "@/lib/auth";
import type { Role } from "@/generated/prisma/enums";

export function unauthorized() {
  return NextResponse.json({ error: "Belum login", type: "auth_required" }, { status: 401 });
}

export function forbidden(pesan = "Akses ditolak untuk role kamu") {
  return NextResponse.json({ error: pesan, type: "forbidden" }, { status: 403 });
}

export function apiError(error: unknown) {
  console.error("[api]", error);
  const pesan = error instanceof Error ? error.message : "Terjadi kesalahan di server";
  return NextResponse.json({ error: pesan, type: "server_error" }, { status: 500 });
}

type HasilAuth = { ok: true; user: PenggunaAktif } | { ok: false; response: NextResponse };

/**
 * Gerbang tunggal untuk route handler: pastikan sudah login, dan kalau `izin`
 * diisi, pastikan role-nya lolos. Dicek di server, bukan sekadar disembunyikan di UI.
 */
export async function wajibLogin(izin?: (role: Role) => boolean): Promise<HasilAuth> {
  const user = await getPenggunaAktif();
  if (!user) return { ok: false, response: unauthorized() };
  if (izin && !izin(user.role)) return { ok: false, response: forbidden() };
  return { ok: true, user };
}
