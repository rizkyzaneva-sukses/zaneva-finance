"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileUp,
  Table2,
  BookOpenCheck,
  Landmark,
  ListTree,
  Users,
  ScrollText,
  CircleHelp,
  PiggyBank,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Role } from "@/generated/prisma/enums";

interface MenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Role minimum yang boleh melihat menu ini */
  butuh?: Role[];
}

const SEMUA_KECUALI_BENDAHARA: Role[] = ["OWNER", "ADMIN", "STAFF"];

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, butuh: SEMUA_KECUALI_BENDAHARA },
  { href: "/rekap", label: "Rekap", icon: FileUp, butuh: SEMUA_KECUALI_BENDAHARA },
  { href: "/transaksi", label: "Transaksi", icon: Table2 },
  { href: "/laporan", label: "Laporan", icon: BookOpenCheck, butuh: SEMUA_KECUALI_BENDAHARA },
  { href: "/alokasi", label: "Alokasi", icon: PiggyBank, butuh: ["OWNER", "ADMIN"] },
  { href: "/master/rekening", label: "Rekening", icon: Landmark, butuh: ["OWNER", "ADMIN"] },
  { href: "/master/kode-akun", label: "Kode Akun", icon: ListTree, butuh: ["OWNER", "ADMIN"] },
  { href: "/pengguna", label: "Pengguna", icon: Users, butuh: ["OWNER"] },
  { href: "/log", label: "Log Aktivitas", icon: ScrollText, butuh: ["OWNER"] },
  { href: "/panduan", label: "Panduan", icon: CircleHelp },
];

export interface PenggunaProps {
  nama: string;
  username: string;
  role: Role;
}

export function AppShell({ user, children }: { user: PenggunaProps; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerBuka, setDrawerBuka] = React.useState(false);

  React.useEffect(() => setDrawerBuka(false), [pathname]);

  const menuTampil = MENU.filter((m) => !m.butuh || m.butuh.includes(user.role));

  // Membuka halaman terlarang lewat URL langsung → alihkan ke halaman pertama yang boleh.
  // API tetap menolak di server; ini hanya supaya user tidak melihat halaman penuh error.
  React.useEffect(() => {
    const item = MENU.find((m) => pathname === m.href || pathname.startsWith(`${m.href}/`));
    if (item?.butuh && !item.butuh.includes(user.role)) {
      router.replace(menuTampil[0]?.href ?? "/panduan");
    }
  }, [pathname, user.role, router, menuTampil]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <nav className="flex flex-col gap-0.5 p-3">
      {menuTampil.map(({ href, label, icon: Icon }) => {
        const aktif = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={aktif ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              aktif
                ? "bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100"
                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-zinc-800"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-gray-200 bg-card dark:border-zinc-700">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerBuka(true)}
              aria-label="Buka menu"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 lg:hidden dark:text-gray-400 dark:hover:bg-zinc-700"
            >
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-base font-semibold text-gray-900 dark:text-gray-50">
              Zaneva Finance
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-50">{user.nama}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{user.role}</div>
            </div>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-[57px] hidden h-[calc(100vh-57px)] w-56 shrink-0 overflow-y-auto border-r border-gray-200 bg-card lg:block dark:border-zinc-700">
          {nav}
        </aside>

        {drawerBuka && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Tutup menu"
              onClick={() => setDrawerBuka(false)}
              className="absolute inset-0 bg-black/50"
            />
            <div className="absolute left-0 top-0 h-full w-64 overflow-y-auto bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-zinc-700">
                <span className="font-semibold text-gray-900 dark:text-gray-50">Menu</span>
                <button
                  type="button"
                  onClick={() => setDrawerBuka(false)}
                  aria-label="Tutup menu"
                  className="text-gray-600 dark:text-gray-400"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {nav}
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
