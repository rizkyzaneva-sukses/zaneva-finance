import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/** App ini single-user (hanya Rizky) — cukup cek sudah login atau belum, tanpa role/DB. */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session.isLoggedIn;
}

export function unauthorized() {
  return NextResponse.json({ error: "Belum login", type: "auth_required" }, { status: 401 });
}

export function apiError(error: unknown) {
  console.error("[api]", error);
  const pesan = error instanceof Error ? error.message : "Terjadi kesalahan di server";
  return NextResponse.json({ error: pesan, type: "server_error" }, { status: 500 });
}
