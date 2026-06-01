"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@ware-house/shared";
import {
  Award,
  Calendar,
  Flame,
  Snowflake,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";

type Insights = {
  highestSalesDay: { date: string; revenue: number } | null;
  lowestSalesDay: { date: string; revenue: number } | null;
  topRevenueProduct: { name: string; revenue: number } | null;
  fastestGrowingProduct: { id: string; name: string; pct: number } | null;
  slowMovingProducts: { id: string; name: string; units: number }[];
  recentTrendPct: number | null;
  avgDailyRevenue: number;
  avgMonthlyRevenue: number;
};

function dateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function InsightCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center gap-2 pb-2">
        <span className="text-muted-foreground">{icon}</span>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-lg font-semibold">{value}</p>
        {sub ? (
          <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function InsightsSection({ data }: { data: Insights | undefined }) {
  if (!data) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const trendKind =
    data.recentTrendPct == null
      ? "—"
      : data.recentTrendPct > 0
        ? "up"
        : data.recentTrendPct < 0
          ? "down"
          : "flat";

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      <InsightCard
        icon={<Award className="h-4 w-4" />}
        label="Highest Sales Day Ever"
        value={data.highestSalesDay ? dateLabel(data.highestSalesDay.date) : "—"}
        sub={
          data.highestSalesDay
            ? formatCurrency(data.highestSalesDay.revenue)
            : "No sales yet"
        }
      />
      <InsightCard
        icon={<Calendar className="h-4 w-4" />}
        label="Lowest Sales Day"
        value={data.lowestSalesDay ? dateLabel(data.lowestSalesDay.date) : "—"}
        sub={
          data.lowestSalesDay
            ? formatCurrency(data.lowestSalesDay.revenue)
            : "—"
        }
      />
      <InsightCard
        icon={<Flame className="h-4 w-4" />}
        label="Top Revenue Product"
        value={data.topRevenueProduct?.name ?? "—"}
        sub={
          data.topRevenueProduct
            ? `${formatCurrency(data.topRevenueProduct.revenue)} total`
            : "No sales yet"
        }
      />
      <InsightCard
        icon={<Zap className="h-4 w-4" />}
        label="Fastest Growing Product"
        value={data.fastestGrowingProduct?.name ?? "—"}
        sub={
          data.fastestGrowingProduct
            ? `+${data.fastestGrowingProduct.pct.toFixed(1)}% (last 30d vs prior 30d)`
            : "Not enough data"
        }
      />
      <InsightCard
        icon={<Snowflake className="h-4 w-4" />}
        label="Slow Moving Products"
        value={
          data.slowMovingProducts.length === 0
            ? "None"
            : `${data.slowMovingProducts.length} product${
                data.slowMovingProducts.length === 1 ? "" : "s"
              }`
        }
        sub={
          data.slowMovingProducts.length > 0
            ? data.slowMovingProducts
                .slice(0, 3)
                .map((p) => p.name)
                .join(", ") +
              (data.slowMovingProducts.length > 3
                ? ` +${data.slowMovingProducts.length - 3} more`
                : "")
            : "All active products are selling"
        }
      />
      <InsightCard
        icon={
          trendKind === "up" ? (
            <TrendingUp className="h-4 w-4" />
          ) : trendKind === "down" ? (
            <TrendingDown className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )
        }
        label="Recent Sales Trend"
        value={
          data.recentTrendPct == null
            ? "—"
            : `${data.recentTrendPct > 0 ? "+" : ""}${data.recentTrendPct.toFixed(1)}%`
        }
        sub="Last 7d vs prior 7d"
      />
      <InsightCard
        icon={<Calendar className="h-4 w-4" />}
        label="Average Daily Revenue"
        value={formatCurrency(data.avgDailyRevenue)}
        sub="Across days with sales"
      />
      <InsightCard
        icon={<Calendar className="h-4 w-4" />}
        label="Average Monthly Revenue"
        value={formatCurrency(data.avgMonthlyRevenue)}
        sub="Across months with sales"
      />
    </div>
  );
}
