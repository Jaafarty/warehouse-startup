"use client";

import { KpiCard } from "./kpi-card";
import { formatCurrency } from "@ware-house/shared";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Trophy,
  TrendingDown,
  Package,
  Calendar,
  CalendarDays,
  Wallet,
  Receipt,
} from "lucide-react";

type Kpis = {
  todayRevenue: number;
  yesterdayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  bestSellingProduct: { id: string; name: string; units: number } | null;
  lowestSellingProduct: { id: string; name: string; units: number } | null;
  unitsSoldToday: number;
  growthVsYesterdayPct: number | null;
  growthVsLastMonthPct: number | null;
};

export function KpiGrid({ data }: { data: Kpis | undefined }) {
  const loading = data === undefined;
  const k = data;

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Today Revenue"
        value={k ? formatCurrency(k.todayRevenue) : "—"}
        icon={<DollarSign className="h-4 w-4" />}
        trendPct={k?.growthVsYesterdayPct ?? null}
        loading={loading}
      />
      <KpiCard
        label="Yesterday Revenue"
        value={k ? formatCurrency(k.yesterdayRevenue) : "—"}
        icon={<Calendar className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="This Week Revenue"
        value={k ? formatCurrency(k.weekRevenue) : "—"}
        icon={<CalendarDays className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="This Month Revenue"
        value={k ? formatCurrency(k.monthRevenue) : "—"}
        icon={<CalendarDays className="h-4 w-4" />}
        trendPct={k?.growthVsLastMonthPct ?? null}
        loading={loading}
      />
      <KpiCard
        label="Total Revenue"
        value={k ? formatCurrency(k.totalRevenue) : "—"}
        icon={<Wallet className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Total Orders"
        value={k ? k.totalOrders.toLocaleString() : "—"}
        icon={<ShoppingCart className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Average Order Value"
        value={k ? formatCurrency(k.avgOrderValue) : "—"}
        icon={<Receipt className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Units Sold Today"
        value={k ? k.unitsSoldToday.toLocaleString() : "—"}
        icon={<Package className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Best Selling Product"
        value={k?.bestSellingProduct?.name ?? "—"}
        sub={
          k?.bestSellingProduct
            ? `${k.bestSellingProduct.units.toLocaleString()} units sold`
            : "No sales yet"
        }
        icon={<Trophy className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Lowest Selling Product"
        value={k?.lowestSellingProduct?.name ?? "—"}
        sub={
          k?.lowestSellingProduct
            ? `${k.lowestSellingProduct.units.toLocaleString()} units sold`
            : "No sales yet"
        }
        icon={<TrendingDown className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Growth vs Yesterday"
        value={
          k?.growthVsYesterdayPct == null
            ? "—"
            : `${k.growthVsYesterdayPct > 0 ? "+" : ""}${k.growthVsYesterdayPct.toFixed(1)}%`
        }
        sub="Today vs yesterday revenue"
        icon={<TrendingUp className="h-4 w-4" />}
        loading={loading}
      />
      <KpiCard
        label="Growth vs Last Month"
        value={
          k?.growthVsLastMonthPct == null
            ? "—"
            : `${k.growthVsLastMonthPct > 0 ? "+" : ""}${k.growthVsLastMonthPct.toFixed(1)}%`
        }
        sub="This month vs last month"
        icon={<TrendingUp className="h-4 w-4" />}
        loading={loading}
      />
    </div>
  );
}
