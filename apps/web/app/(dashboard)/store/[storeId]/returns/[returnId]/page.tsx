"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowLeft } from "lucide-react";
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
      ? { returnId: returnId as any, userId: userId as any }
      : "skip"
  );

  if (ret === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (ret === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Return not found.</p>
        <Link href={`/store/${storeId}/returns`}>
          <Button variant="link" className="px-0 mt-2">
            Back to returns
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/returns`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-mono">{ret.returnNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(ret.createdAt)} by {ret.processedByName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total refund</p>
            <p className="text-2xl font-bold">
              {formatCurrency(ret.totalRefund, "USD")}
            </p>
            {(ret.refundedUSD !== undefined ||
              ret.refundedLBP !== undefined) && (
              <p className="text-xs text-muted-foreground mt-1">
                {ret.refundedUSD
                  ? formatCurrency(ret.refundedUSD, "USD")
                  : null}
                {ret.refundedUSD && ret.refundedLBP ? " + " : ""}
                {ret.refundedLBP
                  ? formatCurrency(ret.refundedLBP, "LBP")
                  : null}
                {ret.exchangeRate
                  ? ` @ ${ret.exchangeRate.toLocaleString()}`
                  : ""}
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="text-2xl font-bold">{ret.itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reason</p>
            <p className="font-medium mt-1">
              {REASON_LABEL[ret.reason] ?? ret.reason}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Original sale</p>
            {ret.sale ? (
              <Link
                href={`/store/${storeId}/sales/${ret.sale._id}`}
                className="font-mono font-medium mt-1 inline-block hover:underline"
              >
                {ret.sale.saleNumber}
              </Link>
            ) : (
              <p className="text-muted-foreground mt-1">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Customer</p>
          {ret.customer ? (
            <div className="mt-1">
              <p className="font-medium">{ret.customer.name}</p>
              <p className="text-sm text-muted-foreground">
                {ret.customer.phone}
              </p>
            </div>
          ) : (
            <p className="mt-1">Walk-in</p>
          )}
        </CardContent>
      </Card>

      {ret.note && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Note</p>
            <p className="mt-1 whitespace-pre-wrap">{ret.note}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Returned items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
              {ret.items.map((it: any) => {
                const cur = (it.currency ?? "USD") as "USD" | "LBP";
                return (
                  <TableRow key={it._id}>
                    <TableCell className="font-medium">
                      {it.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(it.unitPrice, cur)}
                    </TableCell>
                    <TableCell className="text-right">{it.quantity}</TableCell>
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
    </div>
  );
}
