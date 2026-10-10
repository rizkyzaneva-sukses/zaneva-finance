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
  FolderOpen,
  Package,
  Tags,
  Database,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { DialogGantiPassword, TombolGantiPassword } from "@/components/ganti-password";
import type { Role } from "@/generated/prisma/enums";

type Grup = "operasional" | "tutup" | "master" | "administrasi";

interface MenuItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** Role minimum yang boleh melihat menu ini */
  butuh?: Role[];
  /** Fitur lintas brand: disembunyikan untuk pengguna yang dibatasi ke brand tertentu */
  semuaBrand?: boolean;
  grup?: Grup;
}

const SEMUA_KECUALI_BENDAHARA: Role[] = ["OWNER", "ADMIN", "STAFF"];

const GRUP: { id: Grup; label: string }[] = [
  { id: "operasional", label: "Operasional" },
  { id: "tutup", label: "Tutup buku" },
  { id: "master", label: "Master" },
  { id: "administrasi", label: "Administrasi" },
];

const MENU: MenuItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, butuh: SEMUA_KECUALI_BENDAHARA, grup: "operasional" },
  { href: "/rekap", label: "Rekap", icon: FileUp, butuh: SEMUA_KECUALI_BENDAHARA, grup: "operasional" },
  { href: "/transaksi", label: "Transaksi", icon: Table2, grup: "operasional" },
  { href: "/dokumen", label: "Dokumen", icon: FolderOpen, butuh: SEMUA_KECUALI_BENDAHARA, grup: "operasional" },
  { href: "/laporan", label: "Laporan", icon: BookOpenCheck, butuh: SEMUA_KECUALI_BENDAHARA, grup: "tutup" },
  { href: "/alokasi", label: "Alokasi", icon: PiggyBank, butuh: ["OWNER", "ADMIN"], semuaBrand: true, grup: "tutup" },
  { href: "/stok", label: "Stok & HPP", icon: Package, semuaBrand: true, grup: "tutup" },
  { href: "/master/rekening", label: "Rekening", icon: Landmark, butuh: ["OWNER", "ADMIN"], grup: "master" },
  { href: "/master/brand", label: "Brand", icon: Tags, butuh: ["OWNER", "ADMIN"], semuaBrand: true, grup: "master" },
  { href: "/master/kode-akun", label: "Kode Akun", icon: ListTree, butuh: ["OWNER", "ADMIN"], semuaBrand: true, grup: "master" },
  { href: "/pengguna", label: "Pengguna", icon: Users, butuh: ["OWNER"], grup: "administrasi" },
  { href: "/data-demo", label: "Data & Demo", icon: Database, butuh: ["OWNER"], grup: "administrasi" },
  { href: "/log", label: "Log Aktivitas", icon: ScrollText, butuh: ["OWNER"], grup: "administrasi" },
  { href: "/panduan", label: "Panduan", icon: CircleHelp },
];

const TRANSISI = "duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none";

export interface PenggunaProps {
  nama: string;
  username: string;
  role: Role;
  terbatas?: boolean;
}

function sedangAktif(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function labelGrup(id?: Grup) {
  return GRUP.find((g) => g.id === id)?.label;
}

function IkonMenu({ terbuka }: { terbuka: boolean }) {
  return (
    <span aria-hidden className="relative block h-3.5 w-4">
      <span
        className={cn(
          "absolute left-0 block h-[1.5px] w-4 rounded-full bg-current transition-transform",
          TRANSISI,
          terbuka ? "top-[6px] rotate-45" : "top-0"
        )}
      />
      <span
        className={cn(
          "absolute left-0 top-[6px] block h-[1.5px] w-4 rounded-full bg-current transition-opacity duration-200 motion-reduce:transition-none",
          terbuka ? "opacity-0" : "opacity-100"
        )}
      />
      <span
        className={cn(
          "absolute left-0 block h-[1.5px] w-4 rounded-full bg-current transition-transform",
          TRANSISI,
          terbuka ? "top-[6px] -rotate-45" : "top-3"
        )}
      />
    </span>
  );
}

function Merek() {
  return (
    <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-slate-200/90 px-4 dark:border-zinc-800">
      <span
        aria-hidden
        className="grid h-8 w-8 place-items-center rounded-lg bg-[#16325c] text-[11px] font-semibold tracking-wide text-white dark:bg-[#d7e4f6] dark:text-[#12243f]"
      >
        ZF
      </span>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
          Zaneva Finance
        </p>
        <p className="truncate text-[11px] font-medium text-slate-600 dark:text-zinc-400">Rekap keuangan</p>
      </div>
    </div>
  );
}

function TautanMenu({ item, aktif }: { item: MenuItem; aktif: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={aktif ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors lg:min-h-9",
        TRANSISI,
        aktif
          ? "bg-white text-[#16325c] dark:bg-zinc-800 dark:text-[#e7eef8]"
          : "text-slate-700 hover:bg-white/80 dark:text-zinc-300 dark:hover:bg-white/[0.04]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full transition-opacity",
          TRANSISI,
          aktif ? "bg-[#16325c] opacity-100 dark:bg-[#9ebbe4]" : "opacity-0"
        )}
      />
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

function DaftarMenu({ item, pathname, id }: { item: MenuItem[]; pathname: string; id: string }) {
  const grup = GRUP.map((g) => ({
    ...g,
    item: item.filter((m) => m.grup === g.id),
  })).filter((g) => g.item.length > 0);
  const kaki = item.filter((m) => !m.grup);

  return (
    <nav id={id} aria-label="Menu utama" className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        {grup.map((g, indeks) => (
          <div key={g.id} className={cn(indeks > 0 && "mt-5")}>
            <p className="px-2.5 pb-1.5 text-[11px] font-semibold tracking-[0.14em] text-slate-600 uppercase dark:text-zinc-400">
              {g.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {g.item.map((m) => (
                <TautanMenu key={m.href} item={m} aktif={sedangAktif(pathname, m.href)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      {kaki.length > 0 && (
        <div className="shrink-0 border-t border-slate-200/90 px-3 py-3 dark:border-zinc-800">
          {kaki.map((m) => (
            <TautanMenu key={m.href} item={m} aktif={sedangAktif(pathname, m.href)} />
          ))}
        </div>
      )}
    </nav>
  );
}

export function AppShell({ user, children }: { user: PenggunaProps; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [terbuka, setTerbuka] = React.useState(false);
  const [gantiPassword, setGantiPassword] = React.useState(false);
  const tombolMenu = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const menuTampil = React.useMemo(
    () =>
      MENU.filter(
        (m) => (!m.butuh || m.butuh.includes(user.role)) && !(m.semuaBrand && user.terbatas)
      ),
    [user.role, user.terbatas]
  );

  const halaman = menuTampil.find((m) => sedangAktif(pathname, m.href));

  React.useEffect(() => setTerbuka(false), [pathname]);

  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const tutup = () => {
      if (mq.matches) setTerbuka(false);
    };
    mq.addEventListener("change", tutup);
    return () => mq.removeEventListener("change", tutup);
  }, []);

  // Membuka halaman terlarang lewat URL langsung → alihkan ke halaman pertama yang boleh.
  // API tetap menolak di server; ini hanya supaya user tidak melihat halaman penuh error.
  React.useEffect(() => {
    const item = MENU.find((m) => sedangAktif(pathname, m.href));
    const boleh =
      !!item && (!item.butuh || item.butuh.includes(user.role)) && !(item.semuaBrand && user.terbatas);
    if (item && !boleh) {
      router.replace(menuTampil[0]?.href ?? "/panduan");
    }
  }, [pathname, user.role, user.terbatas, router, menuTampil]);

  React.useEffect(() => {
    if (!terbuka) return;
    const sebelumnya = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.querySelector<HTMLElement>("a, button")?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setTerbuka(false);
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const nodes = [tombolMenu.current, ...panel.querySelectorAll<HTMLElement>("a, button")].filter(
        (el): el is HTMLElement => !!el
      );
      if (nodes.length === 0) return;
      const pertama = nodes[0];
      const terakhir = nodes[nodes.length - 1];
      const aktif = document.activeElement;
      if (e.shiftKey && (aktif === pertama || !panel.contains(aktif))) {
        e.preventDefault();
        terakhir.focus();
      } else if (!e.shiftKey && aktif === terakhir) {
        e.preventDefault();
        pertama.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      sebelumnya?.focus();
    };
  }, [terbuka]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const alis = labelGrup(halaman?.grup);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.75rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-slate-200/90 bg-[#f3f5f8] lg:flex dark:border-zinc-800 dark:bg-[#101114]">
        <Merek />
        <DaftarMenu id="navigasi-aplikasi" item={menuTampil} pathname={pathname} />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200/90 bg-card px-3 sm:px-5 dark:border-zinc-800">
          <div className="flex min-w-0 items-center gap-2">
            <button
              ref={tombolMenu}
              type="button"
              onClick={() => setTerbuka((v) => !v)}
              aria-label={terbuka ? "Tutup menu" : "Buka menu"}
              aria-expanded={terbuka}
              aria-controls="menu-aplikasi"
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-slate-800 transition-colors lg:hidden dark:text-zinc-100",
                TRANSISI,
                terbuka
                  ? "border-slate-300 bg-slate-100 dark:border-zinc-600 dark:bg-zinc-800"
                  : "border-slate-200 bg-white hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
              )}
            >
              <IkonMenu terbuka={terbuka} />
            </button>
            <div className="min-w-0 leading-tight">
              {alis && (
                <p className="truncate text-[10px] font-semibold tracking-[0.16em] text-slate-600 uppercase dark:text-zinc-400">
                  {alis}
                </p>
              )}
              <p className="truncate text-sm font-semibold tracking-tight text-slate-900 dark:text-zinc-50">
                {halaman?.label ?? "Zaneva Finance"}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-right leading-tight sm:block">
              <div className="max-w-40 truncate text-sm font-medium text-slate-900 dark:text-zinc-50">{user.nama}</div>
              <div className="text-[10px] font-semibold tracking-[0.14em] text-slate-600 uppercase dark:text-zinc-400">
                {user.role}
              </div>
            </div>
            <ThemeToggle />
            <TombolGantiPassword varian="ikon" onClick={() => setGantiPassword(true)} />
            <button
              type="button"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
        </header>

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8" inert={terbuka}>
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
        <DialogGantiPassword
          buka={gantiPassword}
          username={user.username}
          onTutup={() => setGantiPassword(false)}
        />
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          aria-label="Tutup menu"
          aria-hidden={!terbuka}
          tabIndex={-1}
          onClick={() => setTerbuka(false)}
          className={cn(
            "fixed inset-0 top-14 z-30 bg-slate-950/50 transition-opacity",
            TRANSISI,
            terbuka ? "opacity-100" : "pointer-events-none opacity-0"
          )}
        />
        <div
          ref={panelRef}
          inert={!terbuka}
          aria-hidden={!terbuka}
          className={cn(
            "fixed top-14 bottom-0 left-0 z-40 flex w-[min(19rem,88vw)] flex-col border-r border-slate-200/90 bg-[#f3f5f8] transition-transform dark:border-zinc-800 dark:bg-[#101114]",
            TRANSISI,
            terbuka ? "translate-x-0" : "pointer-events-none -translate-x-full"
          )}
        >
          <div className="shrink-0 border-b border-slate-200/90 px-4 py-3 dark:border-zinc-800">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-zinc-50">{user.nama}</p>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.14em] text-slate-600 uppercase dark:text-zinc-400">
              {user.role}
            </p>
            <TombolGantiPassword
              varian="teks"
              onClick={() => {
                setTerbuka(false);
                setGantiPassword(true);
              }}
            />
          </div>
          <DaftarMenu id="menu-aplikasi" item={menuTampil} pathname={pathname} />
        </div>
      </div>
    </div>
  );
}
