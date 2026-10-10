"use client";

import * as React from "react";
import { KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button, Field, INPUT_CLASS, Modal } from "@/components/ui/primitives";

export function TombolGantiPassword({
  varian,
  onClick,
}: {
  varian: "ikon" | "teks";
  onClick: () => void;
}) {
  if (varian === "ikon") {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Ganti password"
        aria-label="Ganti password"
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        <KeyRound className="h-4 w-4" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-800 hover:bg-slate-200/80 dark:text-zinc-100 dark:hover:bg-zinc-800"
    >
      <KeyRound className="h-4 w-4" strokeWidth={1.75} />
      Ganti password
    </button>
  );
}

function KolomPassword({
  id,
  label,
  value,
  onChange,
  autoComplete,
  lihat,
  onLihat,
  autoFocus,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (nilai: string) => void;
  autoComplete: string;
  lihat: boolean;
  onLihat: () => void;
  autoFocus?: boolean;
}) {
  return (
    <Field label={label} htmlFor={id} required>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={lihat ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          minLength={id === "sekarang" ? 1 : 8}
          maxLength={128}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${INPUT_CLASS} pr-11`}
        />
        <button
          type="button"
          onClick={onLihat}
          aria-label={lihat ? "Sembunyikan password" : "Tampilkan password"}
          className="absolute right-1 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          {lihat ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </Field>
  );
}

export function DialogGantiPassword({
  buka,
  username,
  onTutup,
}: {
  buka: boolean;
  username: string;
  onTutup: () => void;
}) {
  const [sekarang, setSekarang] = React.useState("");
  const [baru, setBaru] = React.useState("");
  const [ulang, setUlang] = React.useState("");
  const [lihat, setLihat] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!buka) return;
    setSekarang("");
    setBaru("");
    setUlang("");
    setLihat(false);
    setLoading(false);
  }, [buka]);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    if (baru !== ulang) {
      toast.error("Ulangi password tidak sama");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sekarang, baru, ulang }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Gagal mengganti password");
        return;
      }
      toast.success("Password diganti. Sesi lain dari akun ini keluar.");
      onTutup();
    } catch {
      toast.error("Gagal menghubungi server");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      buka={buka}
      judul="Ganti password"
      deskripsi={`Akun ${username}. Kamu tetap masuk di perangkat ini.`}
      onTutup={onTutup}
    >
      <form onSubmit={simpan} className="space-y-4">
        <input type="text" name="username" autoComplete="username" value={username} readOnly hidden />
        <KolomPassword
          id="sekarang"
          label="Password sekarang"
          value={sekarang}
          onChange={setSekarang}
          autoComplete="current-password"
          lihat={lihat}
          onLihat={() => setLihat((v) => !v)}
          autoFocus
        />
        <KolomPassword
          id="baru"
          label="Password baru"
          value={baru}
          onChange={setBaru}
          autoComplete="new-password"
          lihat={lihat}
          onLihat={() => setLihat((v) => !v)}
        />
        <KolomPassword
          id="ulang"
          label="Ulangi password baru"
          value={ulang}
          onChange={setUlang}
          autoComplete="new-password"
          lihat={lihat}
          onLihat={() => setLihat((v) => !v)}
        />
        <p className="text-xs text-gray-600 dark:text-gray-400">8–128 karakter. Jangan sama dengan password sekarang.</p>
        <div className="flex justify-end gap-2">
          <Button type="button" varian="sekunder" onClick={onTutup} disabled={loading}>
            Batal
          </Button>
          <Button type="submit" loading={loading}>
            Simpan
          </Button>
        </div>
      </form>
    </Modal>
  );
}
