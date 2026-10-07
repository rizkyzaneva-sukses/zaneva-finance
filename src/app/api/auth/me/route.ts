import { NextResponse } from "next/server";
import { getPenggunaAktif } from "@/lib/auth";

export async function GET() {
  const user = await getPenggunaAktif();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });
  const { brandIds, rekeningIds: _rekeningIds, ...dasar } = user;
  void _rekeningIds;
  return NextResponse.json({ user: { ...dasar, terbatas: brandIds !== null } });
}
