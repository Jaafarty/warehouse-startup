"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart3,
  LayoutDashboard,
  DollarSign,
  ShoppingCart,
  Package,
  Activity,
  Award,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Wallet,
  Sun,
  Receipt,
  PackageCheck,
  Trophy,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@ware-house/shared";
import { PageHeader } from "@/components/layout/page-header";
import { KpiCard, type Accent } from "./kpi-card";
import {
  RangeFilter,
  presetRange,
  type DateRange,
} from "./range-filter";
import { ProductFilter } from "./product-filter";
import { TopProductsTable } from "./top-products-table";
import { DailySummaryTable } from "./daily-summary-table";
import { ExportCsvButton } from "./export-csv-button";
import { DailyRevenueChart } from "./charts/daily-revenue";
import { WeeklyRevenueChart } from "./charts/weekly-revenue";
import { MonthlyRevenueChart } from "./charts/monthly-revenue";
import { TopProductsBar } from "./charts/top-products-bar";
import { ProductSharePie } from "./charts/product-share-pie";
import { QuantityTrendChart } from "./charts/quantity-trend";
import { DowOrdersChart } from "./charts/dow-orders";

// ---- Section accents (literal classes so Tailwind keeps them) ----
const SECTION_CHIP: Record<Accent, string> = {
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};
const SECTION_TITLE: Record<Accent, string> = {
  teal: "text-teal-600 dark:text-teal-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  indigo: "text-indigo-600 dark:text-indigo-400",
  amber: "text-amber-600 dark:text-amber-400",
  rose: "text-rose-600 dark:text-rose-400",
};

function SectionHeader({
  icon: Icon,
  title,
  description,
  accent,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent: Accent;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl",
          SECTION_CHIP[accent]
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <h2 className={cn("text-lg font-semibold tracking-tight", SECTION_TITLE[accent])}>
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  description,
  loading,
  children,
}: {
  title: string;
  description?: string;
  loading?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[260px] w-full" /> : children}
      </CardContent>
    </Card>
  );
}

function pctLabel(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return "—";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function dayLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function AnalyticsView({ storeId }: { storeId: string }) {
  const { userId } = useCurrentUser();
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [productId, setProductId] = useState<string | null>(null);

  const argsBase = userId
    ? { storeId: storeId as Id<"stores">, userId }
    : null;

  const rangeArgs = argsBase
    ? {
        ...argsBase,
        rangeStart: range.start,
        rangeEnd: range.end,
        productId: (productId as Id<"products"> | null) ?? undefined,
      }
    : null;

  const kpis = useQuery(api.analytics.kpis, argsBase ?? "skip");
  const insights = useQuery(api.analytics.insights, argsBase ?? "skip");
  const products = useQuery(
    api.products.list,
    argsBase ? { ...argsBase, includeArchived: false } : "skip"
  );

  const dailyRev = useQuery(api.analytics.dailyRevenue, rangeArgs ?? "skip");
  const weeklyRev = useQuery(
    api.analytics.weeklyRevenue,
    argsBase
      ? { ...argsBase, productId: (productId as Id<"products"> | null) ?? undefined }
      : "skip"
  );
  const monthlyRev = useQuery(
    api.analytics.monthlyRevenue,
    argsBase
      ? { ...argsBase, productId: (productId as Id<"products"> | null) ?? undefined }
      : "skip"
  );
  const topRanked = useQuery(
    api.analytics.topProductsRanked,
    rangeArgs ? { ...rangeArgs, limit: 10 } : "skip"
  );
  const share = useQuery(
    api.analytics.productShare,
    rangeArgs
      ? {
          storeId: rangeArgs.storeId,
          userId: rangeArgs.userId,
          rangeStart: rangeArgs.rangeStart,
          rangeEnd: rangeArgs.rangeEnd,
        }
      : "skip"
  );
  const qtyTrend = useQuery(api.analytics.quantityTrend, rangeArgs ?? "skip");
  const dowOrders = useQuery(api.analytics.ordersByDayOfWeek, rangeArgs ?? "skip");
  const dailySummary = useQuery(api.analytics.dailySummary, rangeArgs ?? "skip");

  const productOptions = useMemo(
    () => (products ?? []).map((p) => ({ _id: String(p._id), name: p.name })),
    [products]
  );

  const topBarData = useMemo(
    () => (topRanked ?? []).map((p) => ({ name: p.name, revenue: p.revenue })),
    [topRanked]
  );

  const k = kpis;
  const kLoading = kpis === undefined;
  const i = insights;
  const iLoading = insights === undefined;

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-8">
      <PageHeader
        icon={BarChart3}
        title="Analytics"
        subtitle="Live sales performance — updates as new sales come in."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <RangeFilter value={range} onChange={setRange} />
        <div className="flex flex-wrap items-center gap-2">
          <ProductFilter
            products={productOptions}
            value={productId}
            onChange={setProductId}
          />
          <ExportCsvButton
            rows={dailySummary}
            filename={`daily-summary-${range.preset}.csv`}
          />
        </div>
      </div>

      {/* ============ OVERVIEW ============ */}
      <section className="space-y-4">
        <SectionHeader
          icon={LayoutDashboard}
          title="Overview"
          description="The big picture at a glance."
          accent="teal"
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Recent Sales Trend"
            value={pctLabel(i?.recentTrendPct)}
            sub="Last 7 days vs prior 7 days"
            icon={<Activity className="h-4 w-4" />}
            trendPct={i?.recentTrendPct ?? null}
            accent="teal"
            loading={iLoading}
          />
          <KpiCard
            label="Avg Daily Revenue"
            value={i ? formatCurrency(i.avgDailyRevenue) : "—"}
            sub="Across days with sales"
            icon={<CalendarDays className="h-4 w-4" />}
            accent="teal"
            loading={iLoading}
          />
          <KpiCard
            label="Avg Monthly Revenue"
            value={i ? formatCurrency(i.avgMonthlyRevenue) : "—"}
            sub="Across months with sales"
            icon={<CalendarRange className="h-4 w-4" />}
            accent="teal"
            loading={iLoading}
          />
          <KpiCard
            label="Best Sales Day"
            value={dayLabel(i?.highestSalesDay?.date)}
            sub={
              i?.highestSalesDay
                ? formatCurrency(i.highestSalesDay.revenue)
                : "No sales yet"
            }
            icon={<Award className="h-4 w-4" />}
            accent="teal"
            loading={iLoading}
          />
        </div>
        <ChartCard
          title="Daily Revenue"
          description="Revenue per day over the selected range"
          loading={dailyRev === undefined}
        >
          <DailyRevenueChart data={dailyRev ?? []} />
        </ChartCard>
      </section>

      {/* ============ REVENUE ============ */}
      <section className="space-y-4">
        <SectionHeader
          icon={DollarSign}
          title="Revenue"
          description="Earnings across time — today, this week, this month and all time."
          accent="emerald"
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Today"
            value={k ? formatCurrency(k.todayRevenue) : "—"}
            icon={<Sun className="h-4 w-4" />}
            trendPct={k?.growthVsYesterdayPct ?? null}
            accent="emerald"
            loading={kLoading}
          />
          <KpiCard
            label="This Week"
            value={k ? formatCurrency(k.weekRevenue) : "—"}
            icon={<CalendarRange className="h-4 w-4" />}
            accent="emerald"
            loading={kLoading}
          />
          <KpiCard
            label="This Month"
            value={k ? formatCurrency(k.monthRevenue) : "—"}
            icon={<CalendarCheck className="h-4 w-4" />}
            trendPct={k?.growthVsLastMonthPct ?? null}
            accent="emerald"
            loading={kLoading}
          />
          <KpiCard
            label="All Time"
            value={k ? formatCurrency(k.totalRevenue) : "—"}
            icon={<Wallet className="h-4 w-4" />}
            accent="emerald"
            loading={kLoading}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Weekly Revenue"
            description="Last 12 weeks"
            loading={weeklyRev === undefined}
          >
            <WeeklyRevenueChart data={weeklyRev ?? []} />
          </ChartCard>
          <ChartCard
            title="Monthly Revenue"
            description="Last 12 months"
            loading={monthlyRev === undefined}
          >
            <MonthlyRevenueChart data={monthlyRev ?? []} />
          </ChartCard>
        </div>
      </section>

      {/* ============ ORDERS ============ */}
      <section className="space-y-4">
        <SectionHeader
          icon={ShoppingCart}
          title="Orders"
          description="Order volume, value and units sold."
          accent="indigo"
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          <KpiCard
            label="Total Orders"
            value={k ? k.totalOrders.toLocaleString() : "—"}
            icon={<ShoppingCart className="h-4 w-4" />}
            accent="indigo"
            loading={kLoading}
          />
          <KpiCard
            label="Avg Order Value"
            value={k ? formatCurrency(k.avgOrderValue) : "—"}
            icon={<Receipt className="h-4 w-4" />}
            accent="indigo"
            loading={kLoading}
          />
          <KpiCard
            label="Units Sold Today"
            value={k ? k.unitsSoldToday.toLocaleString() : "—"}
            icon={<PackageCheck className="h-4 w-4" />}
            accent="indigo"
            loading={kLoading}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Quantity Sold"
            description="Units sold per day over the selected range"
            loading={qtyTrend === undefined}
          >
            <QuantityTrendChart data={qtyTrend ?? []} />
          </ChartCard>
          <ChartCard
            title="Orders by Day of Week"
            description="Order counts grouped by weekday"
            loading={dowOrders === undefined}
          >
            <DowOrdersChart data={dowOrders ?? []} />
          </ChartCard>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Summary</CardTitle>
            <CardDescription>Day-by-day orders, revenue and average order value</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DailySummaryTable data={dailySummary} />
          </CardContent>
        </Card>
      </section>

      {/* ============ PRODUCTS ============ */}
      <section className="space-y-4">
        <SectionHeader
          icon={Package}
          title="Products"
          description="Best and lowest performers."
          accent="amber"
        />
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <KpiCard
            label="Best Selling Product"
            value={k?.bestSellingProduct?.name ?? "—"}
            sub={
              k?.bestSellingProduct
                ? `${k.bestSellingProduct.units.toLocaleString()} units sold`
                : "No sales yet"
            }
            icon={<Trophy className="h-4 w-4" />}
            accent="amber"
            loading={kLoading}
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
            accent="rose"
            loading={kLoading}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Top Selling Products"
            description="By revenue in selected range"
            loading={topRanked === undefined}
          >
            {topBarData.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No sales in this range.
              </div>
            ) : (
              <TopProductsBar data={topBarData} />
            )}
          </ChartCard>
          <ChartCard
            title="Product Share"
            description="Revenue contribution per product"
            loading={share === undefined}
          >
            {!share || share.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No sales in this range.
              </div>
            ) : (
              <ProductSharePie data={share} />
            )}
          </ChartCard>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Products</CardTitle>
            <CardDescription>Sortable — click any column header</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TopProductsTable data={topRanked} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
