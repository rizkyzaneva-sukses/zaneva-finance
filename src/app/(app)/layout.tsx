import { redirect } from "next/navigation";
import { getPenggunaAktif } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getPenggunaAktif();
  if (!user) redirect("/login");

  return (
    <AppShell user={{ nama: user.nama, username: user.username, role: user.role, terbatas: user.brandIds !== null }}>
      {children}
    </AppShell>
  );
}
