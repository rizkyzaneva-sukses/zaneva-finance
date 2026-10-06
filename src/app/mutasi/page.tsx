"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Topbar } from "@/components/topbar";
import { BniTab } from "@/components/mutasi/bni-tab";
import { MandiriTab } from "@/components/mutasi/mandiri-tab";

type Bank = "bni" | "mandiri";

export default function MutasiPage() {
  const [bank, setBank] = React.useState<Bank>("bni");

  const tabs: { key: Bank; label: string }[] = [
    { key: "bni", label: "BNI (Gambar)" },
    { key: "mandiri", label: "Mandiri (PDF)" },
  ];

  return (
    <div className="min-h-screen">
      <Topbar />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div
          role="tablist"
          aria-label="Pilih bank"
          className="mb-4 inline-flex rounded-lg border border-gray-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-800"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={bank === t.key}
              onClick={() => setBank(t.key)}
              className={cn(
                "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
                bank === t.key
                  ? "bg-gray-200 text-gray-900 dark:bg-zinc-700 dark:text-gray-50"
                  : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-700"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {bank === "bni" ? <BniTab /> : <MandiriTab />}
      </main>
    </div>
  );
}
