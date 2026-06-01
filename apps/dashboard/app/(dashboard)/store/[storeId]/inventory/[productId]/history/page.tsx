"use client";

import { useMemo } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@ware-house/shared";
import { ArrowLeft, ArrowUp, ArrowDown, RotateCcw, History } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_LABELS: Record<string, string> = {
  initial: "Initial Stock",
  sale: "Sale",
  return: "Return",
  manual_add: "Manual Add",
  manual_remove: "Manual Remove",
  adjustment: "Adjustment",
};

function MovementIcon({ type }: { type: string }) {
  if (type === "sale" || type === "manual_remove") {
    return <ArrowDown className="h-4 w-4 text-destructive" />;
  }
  if (type === "return") {
    return <RotateCcw className="h-4 w-4 text-[color:var(--color-info)]" />;
  }
  return <ArrowUp className="h-4 w-4 text-[color:var(--color-success)]" />;
}

export default function StockHistoryPage() {
  const { storeId, productId } = useParams<{
    storeId: string;
    productId: string;
  }>();
  const { userId } = useCurrentUser();

  const product = useQuery(
    api.products.get,
    userId ? { productId: productId as Id<"products">, userId } : "skip"
  );

  const movements = useQuery(
    api.stockMovements.listByProduct,
    userId ? { productId: productId as Id<"products">, userId } : "skip"
  );

  const stats = useMemo(() => {
    if (!movements) return null;
    let added = 0;
    let removed = 0;
    for (const m of movements) {
      if (m.quantityChange > 0) added += m.quantityChange;
      else removed += Math.abs(m.quantityChange);
    }
    return { count: movements.length, added, removed };
  }, [movements]);

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={History}
        title="Stock history"
        subtitle={product ? product.name : "Loading…"}
        right={
          <Link href={`/store/${storeId}/inventory/${productId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to product
            </Button>
          </Link>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Movement log</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              {movements === undefined ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : movements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium">No movements yet</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Stock changes will appear here as sales, returns, and
                    adjustments land.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Change</TableHead>
                      <TableHead className="text-right">Before</TableHead>
                      <TableHead className="text-right">After</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Note</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movements.map((m) => (
                      <TableRow key={m._id}>
                        <TableCell>
                          <MovementIcon type={m.type} />
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {TYPE_LABELS[m.type] ?? m.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono ${
                            m.quantityChange > 0
                              ? "text-[color:var(--color-success)]"
                              : "text-destructive"
                          }`}
                        >
                          {m.quantityChange > 0 ? "+" : ""}
                          {m.quantityChange}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.quantityBefore}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {m.quantityAfter}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {m.performedByName}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-[150px] truncate">
                          {m.note || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                          {formatDate(m.timestamp)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At a glance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Current stock</p>
                <p className="text-3xl font-bold mt-0.5">
                  {product ? product.quantity : "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t pt-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total added</p>
                  <p className="font-mono font-semibold text-[color:var(--color-success)]">
                    {stats ? `+${stats.added}` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total removed</p>
                  <p className="font-mono font-semibold text-destructive">
                    {stats ? `−${stats.removed}` : "—"}
                  </p>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-xs text-muted-foreground">Movements</p>
                <p className="font-medium">{stats ? stats.count : "—"}</p>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
