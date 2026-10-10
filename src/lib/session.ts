import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  /** Salinan `User.tokenSesi` saat login. Tidak cocok = sesi dibatalkan. */
  tokenSesi?: number;
}

/**
 * Resolve & validasi secret saat DIPANGGIL (runtime), bukan saat module load.
 *
 * Fix: validasi sebelumnya ada di module scope, sehingga `next build` selalu
 * gagal dengan "Failed to collect page data" — karena saat build NODE_ENV sudah
 * "production" tapi SESSION_SECRET belum ter-inject.
 */
function resolveSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production" && (!secret || secret.length < 32)) {
    throw new Error("SESSION_SECRET wajib diisi minimal 32 karakter di produksi");
  }
  return secret || "dev_only_password_at_least_32_characters_long";
}

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "zaneva_finance_session";

export function getSessionOptions(): SessionOptions {
  return {
    password: resolveSecret(),
    cookieName: COOKIE_NAME,
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
    },
  };
}

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, getSessionOptions());
}

// Generate secret: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
