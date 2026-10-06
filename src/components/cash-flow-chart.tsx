"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRupiah } from "@/lib/utils";

export interface TitikBulan {
  bulan: string; // "2026-10"
  masuk: number;
  keluar: number;
  net: number;
}

const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function labelBulan(kunci: string): string {
  const [tahun, bulan] = kunci.split("-");
  return `${NAMA_BULAN[Number(bulan) - 1]} ${tahun.slice(2)}`;
}

/** Sumbu Y dalam juta supaya tidak jadi deretan angka panjang yang tak terbaca. */
function ringkasAngka(nilai: number): string {
  if (Math.abs(nilai) >= 1_000_000_000) return `${(nilai / 1_000_000_000).toFixed(1)} M`;
  if (Math.abs(nilai) >= 1_000_000) return `${Math.round(nilai / 1_000_000)} jt`;
  if (Math.abs(nilai) >= 1_000) return `${Math.round(nilai / 1_000)} rb`;
  return String(nilai);
}

function TooltipKustom({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const masuk = payload.find((p) => p.name === "Uang masuk")?.value ?? 0;
  const keluar = payload.find((p) => p.name === "Uang keluar")?.value ?? 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-card px-3 py-2 text-sm shadow-lg dark:border-zinc-700">
      <div className="mb-1.5 font-medium text-gray-900 dark:text-gray-50">
        {labelBulan(String(label))}
      </div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
            <span className="h-2 w-2 rounded-sm" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular-nums text-gray-900 dark:text-gray-50">
            {formatRupiah(p.value ?? 0)}
          </span>
        </div>
      ))}
      <div className="mt-1.5 flex items-center justify-between gap-4 border-t border-gray-200 pt-1.5 dark:border-zinc-700">
        <span className="text-gray-600 dark:text-gray-400">Net</span>
        <span className="tabular-nums font-medium text-gray-900 dark:text-gray-50">
          {formatRupiah(masuk - keluar)}
        </span>
      </div>
    </div>
  );
}

export function CashFlowChart({ data }: { data: TitikBulan[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }} barGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis
            dataKey="bulan"
            tickFormatter={labelBulan}
            tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
          />
          <YAxis
            tickFormatter={ringkasAngka}
            tick={{ fontSize: 12, fill: "var(--chart-axis)" }}
            tickLine={false}
            axisLine={false}
            width={56}
          />
          <Tooltip content={<TooltipKustom />} cursor={{ fill: "var(--chart-grid)", opacity: 0.35 }} />
          <Legend
            verticalAlign="top"
            align="right"
            height={28}
            iconType="square"
            iconSize={9}
            formatter={(value) => (
              <span className="text-xs text-gray-600 dark:text-gray-400">{value}</span>
            )}
          />
          {/* maxBarSize menahan batang jadi melebar konyol saat datanya cuma 1-2 bulan */}
          <Bar
            dataKey="masuk"
            name="Uang masuk"
            fill="var(--chart-masuk)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
          <Bar
            dataKey="keluar"
            name="Uang keluar"
            fill="var(--chart-keluar)"
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
