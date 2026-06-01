"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { Receipt, RotateCcw, User, Package, CreditCard, StickyNote } from "lucide-react";
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
import { PageHeader } from "@/components/layout/page-header";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  completed: "default",
  partially_returned: "secondary",
  returned: "outline",
};

const REASON_LABEL: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong item",
  damaged_in_transit: "Damaged in transit",
  customer_changed_mind: "Customer changed mind",
  other: "Other",
};

export default function SaleDetailPage() {
  const { storeId, saleId } = useParams<{
    storeId: string;
    saleId: string;
  }>();
  const { userId } = useCurrentUser();

  const sale = useQuery(
    api.sales.get,
    userId ? { saleId: saleId as Id<"sales">, userId } : "skip"
  );

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const returnsPerms = store?.effectivePermissions?.returns;
  const returnsEnabled = returnsPerms?.enabled ?? false;
  const canViewReturns =
    isPrivileged ||
    (returnsEnabled && (returnsPerms?.functions?.view_list ?? false));
  const canProcessReturn =
    isPrivileged ||
    (returnsEnabled && (returnsPerms?.functions?.process_return ?? false));

  const returns = useQuery(
    api.returns.getBySale,
    userId && canViewReturns
      ? { saleId: saleId as Id<"sales">, userId }
      : "skip"
  );

  if (sale === undefined) {
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

  if (sale === null) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-4">
        <PageHeader
          icon={Receipt}
          title="Sale not found"
          subtitle="This sale may have been removed."
        />
        <Link href={`/store/${storeId}/sales`}>
          <Button variant="outline">Back to sales</Button>
        </Link>
      </div>
    );
  }

  const hasReturnableItems = sale.items.some(
    (i) => i.returnedQuantity < i.quantity
  );
  const totalUSD = sale.totalUSD ?? sale.totalAmount;

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Receipt}
        title={
          <span className="flex items-center gap-3">
            <span className="font-mono">{sale.saleNumber}</span>
            <Badge variant={STATUS_VARIANT[sale.status] ?? "outline"}>
              {sale.status.replace(/_/g, " ")}
            </Badge>
          </span>
        }
        subtitle={`${formatDate(sale.createdAt)} by ${sale.createdByName}`}
        right={
          hasReturnableItems &&
          sale.status !== "returned" &&
          canProcessReturn ? (
            <Link href={`/store/${storeId}/sales/${saleId}/return`}>
              <Button>
                <RotateCcw className="h-4 w-4 mr-2" />
                Process Return
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
                Items
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item) => {
                    const cur = (item.currency ?? "USD") as "USD" | "LBP";
                    return (
                      <TableRow key={item._id}>
                        <TableCell className="font-medium">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(item.unitPrice, cur)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.returnedQuantity > 0 ? (
                            <span className="text-destructive">
                              {item.returnedQuantity}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.totalPrice, cur)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {(sale.paidUSD !== undefined || sale.paidLBP !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  Payment
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Paid USD</p>
                    <p className="font-medium">
                      {formatCurrency(sale.paidUSD ?? 0, "USD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Paid LBP</p>
                    <p className="font-medium">
                      {formatCurrency(sale.paidLBP ?? 0, "LBP")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Sale rate</p>
                    <p className="font-medium font-mono">
                      1 USD = {(sale.exchangeRate ?? 1).toLocaleString()} LBP
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {sale.note && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  Note
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{sale.note}</p>
              </CardContent>
            </Card>
          )}

          {canViewReturns && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RotateCcw className="h-4 w-4 text-muted-foreground" />
                  Returns history
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {returns === undefined ? (
                  <div className="p-4">
                    <Skeleton className="h-12" />
                  </div>
                ) : returns.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No returns processed for this sale yet.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Return #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Refund</TableHead>
                        <TableHead>Processed by</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {returns.map((r) => (
                        <TableRow key={r._id}>
                          <TableCell>
                            <Link
                              href={`/store/${storeId}/returns/${r._id}`}
                              className="font-mono font-medium hover:underline"
                            >
                              {r.returnNumber}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(r.createdAt)}
                          </TableCell>
                          <TableCell>
                            {REASON_LABEL[r.reason] ?? r.reason}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.itemCount}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            <div>{formatCurrency(r.totalRefund, "USD")}</div>
                            {(r.refundedUSD !== undefined ||
                              r.refundedLBP !== undefined) &&
                              ((r.refundedUSD ?? 0) > 0 ||
                                (r.refundedLBP ?? 0) > 0) && (
                                <div className="text-xs text-muted-foreground">
                                  {r.refundedUSD
                                    ? formatCurrency(r.refundedUSD, "USD")
                                    : null}
                                  {r.refundedUSD && r.refundedLBP ? " + " : ""}
                                  {r.refundedLBP
                                    ? formatCurrency(r.refundedLBP, "LBP")
                                    : null}
                                </div>
                              )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {r.processedByName}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(totalUSD, "USD")}
                </p>
                {sale.totalLBP !== undefined && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatCurrency(sale.totalLBP, "LBP")}
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Items</p>
                  <p className="text-xl font-bold">{sale.itemCount}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge
                    variant={STATUS_VARIANT[sale.status] ?? "outline"}
                    className="mt-0.5"
                  >
                    {sale.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
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
              {sale.customer ? (
                <div className="space-y-0.5">
                  <p className="font-medium truncate">{sale.customer.name}</p>
                  <p className="text-sm text-muted-foreground truncate">
                    {sale.customer.phone}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Walk-in customer.
                </p>
              )}
            </CardContent>
          </Card>

          {hasReturnableItems &&
            sale.status !== "returned" &&
            canProcessReturn && (
              <Link
                href={`/store/${storeId}/sales/${saleId}/return`}
                className="block"
              >
                <Button className="w-full">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Process Return
                </Button>
              </Link>
            )}
        </aside>
      </div>
    </div>
  );
}
