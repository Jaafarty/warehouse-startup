"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

// Section accents — keep these as literal class strings so Tailwind keeps them.
export type Accent = "teal" | "emerald" | "indigo" | "amber" | "rose";

const ACCENT_ICON: Record<Accent, string> = {
  teal: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

type Props = {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
  trendPct?: number | null;
  loading?: boolean;
  accent?: Accent;
};

export function KpiCard({ label, value, sub, icon, trendPct, loading, accent }: Props) {
  const trendKind =
    trendPct == null || Number.isNaN(trendPct)
      ? "neutral"
      : trendPct > 0
        ? "up"
        : trendPct < 0
          ? "down"
          : "neutral";

  const TrendIcon =
    trendKind === "up" ? ArrowUpRight : trendKind === "down" ? ArrowDownRight : Minus;

  const trendColor =
    trendKind === "up"
      ? "text-[color:var(--color-success)]"
      : trendKind === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon ? (
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              accent ? ACCENT_ICON[accent] : "text-muted-foreground"
            )}
          >
            {icon}
          </span>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-2xl font-semibold tabular-nums">{value}</p>
            {sub ? (
              <p className="text-xs text-muted-foreground">{sub}</p>
            ) : null}
            {trendPct != null && !Number.isNaN(trendPct) ? (
              <div className={cn("flex items-center gap-1 text-xs", trendColor)}>
                <TrendIcon className="h-3 w-3" />
                <span className="tabular-nums">
                  {trendPct > 0 ? "+" : ""}
                  {trendPct.toFixed(1)}%
                </span>
                <span className="text-muted-foreground">vs prior</span>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
