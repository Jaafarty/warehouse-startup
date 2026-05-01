"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowLeft, RotateCcw, User } from "lucide-react";
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
    userId ? { saleId: saleId as any, userId: userId as any } : "skip"
  );

  const returns = useQuery(
    api.returns.getBySale,
    userId ? { saleId: saleId as any, userId: userId as any } : "skip"
  );

  if (sale === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (sale === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Sale not found.</p>
        <Link href={`/store/${storeId}/sales`}>
          <Button variant="link" className="px-0 mt-2">
            Back to sales
          </Button>
        </Link>
      </div>
    );
  }

  const hasReturnableItems = sale.items.some(
    (i: any) => i.returnedQuantity < i.quantity
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/store/${storeId}/sales`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono">
                {sale.saleNumber}
              </h1>
              <Badge variant={STATUS_VARIANT[sale.status] ?? "outline"}>
                {sale.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(sale.createdAt)} by {sale.createdByName}
            </p>
          </div>
        </div>
        {hasReturnableItems && sale.status !== "returned" && (
          <Link
            href={`/store/${storeId}/sales/${saleId}/return`}
            className="inline-flex items-center justify-center rounded-lg border px-2.5 h-8 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Process Return
          </Link>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">
              {formatCurrency(sale.totalUSD ?? sale.totalAmount, "USD")}
            </p>
            {sale.totalLBP !== undefined && (
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(sale.totalLBP, "LBP")}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="text-2xl font-bold">{sale.itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge
              variant={STATUS_VARIANT[sale.status] ?? "outline"}
              className="mt-1"
            >
              {sale.status.replace(/_/g, " ")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Customer</p>
            {sale.customer ? (
              <div className="mt-1">
                <p className="font-medium truncate">{sale.customer.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {sale.customer.phone}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Walk-in
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Payment breakdown */}
      {(sale.paidUSD !== undefined || sale.paidLBP !== undefined) && (
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-sm">
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
                <p className="font-medium">
                  1 USD ={" "}
                  {(sale.exchangeRate ?? 1).toLocaleString()} LBP
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {sale.note && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Note</p>
            <p className="mt-1">{sale.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
              {sale.items.map((item: any) => {
                const cur = (item.currency ?? "USD") as "USD" | "LBP";
                return (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice, cur)}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
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

      {/* Returns History */}
      <Card>
        <CardHeader>
          <CardTitle>Returns history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                {returns.map((r: any) => (
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
                    <TableCell>{REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                    <TableCell className="text-right">{r.itemCount}</TableCell>
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
    </div>
  );
}
