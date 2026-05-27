"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Search,
  Check,
} from "lucide-react";

/* Real mini-versions of the product UI used as section visuals — not fake
   screenshots. Numbers are illustrative sample data. */

const TEAL = "#0d9488";

// illustrative sample series
const SERIES = [
  { v: 18 }, { v: 24 }, { v: 22 }, { v: 31 }, { v: 28 },
  { v: 39 }, { v: 36 }, { v: 48 }, { v: 44 }, { v: 57 },
];

function MiniChart() {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={SERIES} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="wh-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={TEAL} stopOpacity={0.28} />
            <stop offset="100%" stopColor={TEAL} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={TEAL}
          strokeWidth={2}
          fill="url(#wh-area)"
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StatusBadge({ kind }: { kind: "in" | "low" | "out" }) {
  const map = {
    in: { label: "In stock", cls: "bg-emerald-50 text-emerald-700" },
    low: { label: "Low", cls: "bg-amber-50 text-amber-700" },
    out: { label: "Out", cls: "bg-rose-50 text-rose-700" },
  }[kind];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${map.cls}`}
    >
      {map.label}
    </span>
  );
}

/* Hero composite surface: KPI row + revenue chart + low-stock alert. */
export function HeroDashboard() {
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-20px_rgba(15,40,50,0.25)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-primary">
            <Package size={14} strokeWidth={1.75} />
          </span>
          <span className="text-sm font-semibold text-foreground">
            Downtown Store
          </span>
        </div>
        <span className="text-xs text-muted-foreground">Live</span>
      </div>

      <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
        {[
          { label: "Revenue (wk)", value: "$12,480" },
          { label: "Orders", value: "318" },
          { label: "Low stock", value: "7" },
        ].map((k) => (
          <div key={k.label} className="px-5 py-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {k.label}
            </p>
            <p className="mt-1 text-xl font-bold tracking-tight text-foreground">
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="px-5 pt-4">
        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <TrendingUp size={14} strokeWidth={1.75} />
          +18% vs last week
        </div>
        <div className="h-28 w-full">
          <MiniChart />
        </div>
      </div>

      <div className="m-5 mt-2 flex items-center gap-3 rounded-xl bg-amber-50 px-4 py-3">
        <AlertTriangle size={16} strokeWidth={1.75} className="text-amber-600" />
        <p className="text-[13px] text-amber-800">
          <span className="font-semibold">Coffee Beans 1kg</span> hit reorder
          point
        </p>
      </div>
    </div>
  );
}

export function InventoryPreview() {
  const rows = [
    { name: "Coffee Beans 1kg", cat: "Beverages", qty: 6, s: "low" as const },
    { name: "Ceramic Mug", cat: "Kitchenware", qty: 142, s: "in" as const },
    { name: "Steel Kettle", cat: "Appliances", qty: 0, s: "out" as const },
    { name: "Paper Filters", cat: "Beverages", qty: 88, s: "in" as const },
  ];
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-[0_18px_50px_-24px_rgba(15,40,50,0.22)]">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Search size={15} strokeWidth={1.75} className="text-muted-foreground" />
        <span className="text-[13px] text-muted-foreground">
          Search products…
        </span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li
            key={r.name}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium text-foreground">
                {r.name}
              </p>
              <p className="text-[11px] text-muted-foreground">{r.cat}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-foreground">
                {r.qty}
              </span>
              <StatusBadge kind={r.s} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SalesPreview() {
  const items = [
    { q: 2, name: "Ceramic Mug", total: "$24.00" },
    { q: 1, name: "Steel Kettle", total: "$39.00" },
    { q: 3, name: "Coffee Beans 1kg", total: "$54.00" },
  ];
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-[0_18px_50px_-24px_rgba(15,40,50,0.22)]">
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <span className="font-[family-name:var(--font-mono)] text-[13px] text-foreground">
          S-20260527-0042
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
          <Check size={12} strokeWidth={2.25} />
          Paid
        </span>
      </div>
      <ul className="divide-y divide-border px-5">
        {items.map((it) => (
          <li
            key={it.name}
            className="flex items-center justify-between py-2.5 text-[13px]"
          >
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground">{it.q}×</span>{" "}
              {it.name}
            </span>
            <span className="font-[family-name:var(--font-mono)] tabular-nums text-foreground">
              {it.total}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-border px-5 py-3.5">
        <span className="text-[13px] font-semibold text-foreground">Total</span>
        <span className="font-[family-name:var(--font-mono)] text-base font-semibold tabular-nums text-foreground">
          $117.00
        </span>
      </div>
    </div>
  );
}

export function AnalyticsPreview() {
  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border bg-card p-5 shadow-[0_18px_50px_-24px_rgba(15,40,50,0.22)]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        Revenue · last 30 days
      </p>
      <div className="mt-1 flex items-end gap-2">
        <span className="text-2xl font-bold tracking-tight text-foreground">
          $48,920
        </span>
        <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
          <TrendingUp size={13} strokeWidth={1.75} />
          +12%
        </span>
      </div>
      <div className="mt-3 h-24 w-full">
        <MiniChart />
      </div>
    </div>
  );
}
