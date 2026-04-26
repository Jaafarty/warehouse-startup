"use client";

import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KpiGrid } from "./kpi-grid";
import {
  RangeFilter,
  presetRange,
  type DateRange,
} from "./range-filter";
import { ProductFilter } from "./product-filter";
import { InsightsSection } from "./insights-section";
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
        {description ? (
          <CardDescription>{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsView({ storeId }: { storeId: string }) {
  const { userId } = useCurrentUser();
  const [range, setRange] = useState<DateRange>(() => presetRange("30d"));
  const [productId, setProductId] = useState<string | null>(null);

  const argsBase = userId
    ? { storeId: storeId as any, userId: userId as any }
    : null;

  const rangeArgs = argsBase
    ? {
        ...argsBase,
        rangeStart: range.start,
        rangeEnd: range.end,
        productId: (productId as any) ?? undefined,
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
      ? { ...argsBase, productId: (productId as any) ?? undefined }
      : "skip"
  );
  const monthlyRev = useQuery(
    api.analytics.monthlyRevenue,
    argsBase
      ? { ...argsBase, productId: (productId as any) ?? undefined }
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
    () =>
      (products ?? []).map((p: any) => ({ _id: String(p._id), name: p.name })),
    [products]
  );

  const topBarData = useMemo(
    () =>
      (topRanked ?? []).map((p: any) => ({
        name: p.name,
        revenue: p.revenue,
      })),
    [topRanked]
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Live sales performance — updates as new sales come in.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <RangeFilter value={range} onChange={setRange} />
        <div className="flex flex-wrap items-center gap-2">
          <ProductFilter
            products={productOptions}
            value={productId}
            onChange={setProductId}
          />
          <ExportCsvButton
            rows={dailySummary as any}
            filename={`daily-summary-${range.preset}.csv`}
          />
        </div>
      </div>

      <KpiGrid data={kpis as any} />

      <ChartCard
        title="Daily Revenue"
        description="Revenue per day over the selected range"
        loading={dailyRev === undefined}
      >
        <DailyRevenueChart data={(dailyRev as any) ?? []} />
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Weekly Revenue"
          description="Last 12 weeks"
          loading={weeklyRev === undefined}
        >
          <WeeklyRevenueChart data={(weeklyRev as any) ?? []} />
        </ChartCard>
        <ChartCard
          title="Monthly Revenue"
          description="Last 12 months"
          loading={monthlyRev === undefined}
        >
          <MonthlyRevenueChart data={(monthlyRev as any) ?? []} />
        </ChartCard>
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
          {!share || (share as any).length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No sales in this range.
            </div>
          ) : (
            <ProductSharePie data={share as any} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Quantity Sold Trend"
          description="Units per day over the selected range"
          loading={qtyTrend === undefined}
        >
          <QuantityTrendChart data={(qtyTrend as any) ?? []} />
        </ChartCard>
        <ChartCard
          title="Orders by Day of Week"
          description="Order counts grouped by weekday"
          loading={dowOrders === undefined}
        >
          <DowOrdersChart data={(dowOrders as any) ?? []} />
        </ChartCard>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Insights</h2>
        <InsightsSection data={insights as any} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top Products</CardTitle>
            <CardDescription>Sortable — click any column header</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <TopProductsTable data={topRanked as any} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily Summary</CardTitle>
            <CardDescription>Day-by-day breakdown</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <DailySummaryTable data={dailySummary as any} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
