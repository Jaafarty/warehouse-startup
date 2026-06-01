"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@ware-house/shared";
import {
  RotateCcw,
  Package,
  StickyNote,
  User,
  Receipt,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/layout/page-header";

const REASON_LABEL: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong item",
  damaged_in_transit: "Damaged in transit",
  customer_changed_mind: "Customer changed mind",
  other: "Other",
};

export default function ReturnDetailPage() {
  const { storeId, returnId } = useParams<{
    storeId: string;
    returnId: string;
  }>();
  const { userId } = useCurrentUser();

  const ret = useQuery(
    api.returns.get,
    userId
      ? { returnId: returnId as Id<"saleReturns">, userId }
      : "skip"
  );

  if (ret === undefined) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (ret === null) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-4">
        <PageHeader
          icon={RotateCcw}
          title="Return not found"
          subtitle="This return may have been removed."
        />
        <Link href={`/store/${storeId}/returns`}>
          <Button variant="outline">Back to returns</Button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={RotateCcw}
        title={<span className="font-mono">{ret.returnNumber}</span>}
        subtitle={`${formatDate(ret.createdAt)} by ${ret.processedByName}`}
        right={
          ret.sale ? (
            <Link href={`/store/${storeId}/sales/${ret.sale._id}`}>
              <Button variant="outline">
                <Receipt className="h-4 w-4 mr-2" />
                View sale
              </Button>
            </Link>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Returned items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Unit price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ret.items.map((it) => {
                    const cur = (it.currency ?? "USD") as "USD" | "LBP";
                    return (
                      <TableRow key={it._id}>
                        <TableCell className="font-medium">
                          {it.productName}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(it.unitPrice, cur)}
                        </TableCell>
                        <TableCell className="text-right">
                          {it.quantity}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(it.totalRefund, cur)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {ret.note && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{ret.note}</p>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refund summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Total refund</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(ret.totalRefund, "USD")}
                </p>
                {(ret.refundedUSD !== undefined ||
                  ret.refundedLBP !== undefined) &&
                  ((ret.refundedUSD ?? 0) > 0 ||
                    (ret.refundedLBP ?? 0) > 0) && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ret.refundedUSD
                        ? formatCurrency(ret.refundedUSD, "USD")
                        : null}
                      {ret.refundedUSD && ret.refundedLBP ? " + " : ""}
                      {ret.refundedLBP
                        ? formatCurrency(ret.refundedLBP, "LBP")
                        : null}
                    </p>
                  )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-xl font-bold">{ret.itemCount}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="text-sm font-medium truncate">
                    {REASON_LABEL[ret.reason] ?? ret.reason}
                  </p>
                </div>
              </div>
              {ret.exchangeRate && (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    Locked rate:{" "}
                    <span className="font-medium text-foreground font-mono">
                      1 USD = {ret.exchangeRate.toLocaleString()} LBP
                    </span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Receipt className="h-4 w-4 text-muted-foreground" />
                Original sale
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ret.sale ? (
                <Link
                  href={`/store/${storeId}/sales/${ret.sale._id}`}
                  className="font-mono font-medium hover:underline"
                >
                  {ret.sale.saleNumber}
                </Link>
              ) : (
                <p className="text-sm text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-muted-foreground" />
                Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              {ret.customer ? (
                <div className="space-y-0.5">
                  <p className="font-medium truncate">{ret.customer.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {ret.customer.phone}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Walk-in customer.
                </p>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
