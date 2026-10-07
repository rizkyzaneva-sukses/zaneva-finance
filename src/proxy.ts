import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/api/health"];

/**
 * Hanya gerbang kasar: ada cookie session atau tidak. Verifikasi user & role
 * yang sebenarnya dilakukan di tiap route handler lewat `wajibLogin()`, karena
 * middleware tidak bisa akses database.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const cookieName = process.env.SESSION_COOKIE_NAME || "zaneva_finance_session";
  const hasSession = req.cookies.has(cookieName);

  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Belum login", type: "auth_required" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    // Simpan tujuan lengkap beserta filternya, dan bersihkan query lama supaya
    // URL login tidak membawa parameter halaman asal.
    const tujuan = pathname + req.nextUrl.search;
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("return_to", tujuan);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
