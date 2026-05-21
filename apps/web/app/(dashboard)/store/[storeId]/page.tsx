"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@ware-house/shared";
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  TrendingUp,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const chartConfig = {
  revenue: {
    label: "Revenue",
    color: "var(--color-primary)",
  },
  count: {
    label: "Sales",
    color: "var(--color-secondary)",
  },
} satisfies ChartConfig;

export default function StoreDashboardPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );

  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const canViewAnalytics =
    isPrivileged || (store?.effectivePermissions?.analytics?.enabled ?? false);
  const shiftFns = store?.effectivePermissions?.shifts?.functions ?? {};
  const canViewOwnShift =
    isPrivileged || (shiftFns.view_own ?? false);
  const canOpenShift = isPrivileged || (shiftFns.open_shift ?? false);

  const rate = useQuery(
    api.exchangeRates.getCurrent,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const canSetRate =
    isPrivileged ||
    (store?.effectivePermissions?.exchange_rate?.functions?.set_rate ?? false);

  const activeShift = useQuery(
    api.shifts.getActive,
    userId && store?.shiftsEnabled && canViewOwnShift
      ? { storeId: storeId as Id<"stores">, userId }
      : "skip"
  );

  const analyticsArgs =
    userId && canViewAnalytics
      ? { storeId: storeId as Id<"stores">, userId: userId }
      : "skip";

  const overview = useQuery(api.analytics.overview, analyticsArgs);

  const topProducts = useQuery(api.analytics.topProducts,
    analyticsArgs === "skip" ? "skip" : { ...analyticsArgs, limit: 5 }
  );

  const salesTrend = useQuery(api.analytics.salesTrend,
    analyticsArgs === "skip" ? "skip" : { ...analyticsArgs, days: 14 }
  );

  const loading = store === undefined || (canViewAnalytics && overview === undefined);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your store performance.
        </p>
      </div>

      {rate === null && (
        <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="py-4 text-sm flex items-center justify-between gap-4">
            <p>
              No exchange rate set yet. Sales will be blocked until one is configured.
            </p>
            {canSetRate && (
              <Link href={`/store/${storeId}/exchange-rate`}>
                <Button variant="outline" size="sm">
                  Set exchange rate
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active shift widget — only when feature is enabled and caller can see own shifts */}
      {store?.shiftsEnabled && canViewOwnShift && (
        <Card className={activeShift ? "border-primary/40" : ""}>
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-muted-foreground" />
              {activeShift ? (
                <div>
                  <p className="font-medium">Active shift</p>
                  <p className="text-xs text-muted-foreground">
                    Opened {formatDate(activeShift.openedAt)} ·{" "}
                    {formatCurrency(activeShift.openingUSD, "USD")} /{" "}
                    {formatCurrency(activeShift.openingLBP, "LBP")} opening
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">No active shift</p>
                  <p className="text-xs text-muted-foreground">
                    {canOpenShift
                      ? "Sales and returns are blocked until you open one."
                      : "Ask the cashier to open a shift before recording sales."}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {activeShift ? (
                <Link href={`/store/${storeId}/shifts/${activeShift._id}`}>
                  <Button variant="outline" size="sm">
                    Manage shift
                  </Button>
                </Link>
              ) : (
                canOpenShift && (
                  <Link href={`/store/${storeId}/shifts/new`}>
                    <Button size="sm">Open shift</Button>
                  </Link>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {!canViewAnalytics && !loading ? (
        <p className="text-sm text-muted-foreground">Analytics not enabled for your role.</p>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue (30d)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">
                {formatCurrency(overview!.totalRevenue)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Sales (30d)</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{overview!.totalSales}</p>
                <p className="text-xs text-muted-foreground">
                  {overview!.completedSales} completed
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">{overview!.totalProducts}</p>
                <p className="text-xs text-muted-foreground">
                  Inventory value: {formatCurrency(overview!.totalInventoryValue)}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Stock Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <p className="text-2xl font-bold">
                  {overview!.lowStockProducts}
                </p>
                <p className="text-xs text-muted-foreground">
                  {overview!.outOfStockProducts} out of stock
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      {canViewAnalytics && <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Sales Trend (14 days)
            </CardTitle>
            <CardDescription>Daily revenue overview</CardDescription>
          </CardHeader>
          <CardContent>
            {salesTrend === undefined ? (
              <Skeleton className="h-[250px]" />
            ) : (
              <ChartContainer config={chartConfig} className="h-[250px] w-full">
                <BarChart data={salesTrend} accessibilityLayer>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={12}
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <Tooltip content={<ChartTooltipContent />} />
                  <Bar
                    dataKey="revenue"
                    fill="var(--color-revenue)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle>Top Products</CardTitle>
            <CardDescription>By revenue (all time)</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts === undefined ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : topProducts.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No sales data yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topProducts.map((product, i: number) => (
                    <TableRow key={product.productId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            {i + 1}
                          </Badge>
                          {product.productName}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {product.totalQuantity}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(product.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>}
    </div>
  );
}
