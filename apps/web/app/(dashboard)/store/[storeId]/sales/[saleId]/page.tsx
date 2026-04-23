"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { returnSaleItems } from "@/app/actions/sales";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  partially_returned: "secondary",
  returned: "outline",
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

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnQtys, setReturnQtys] = useState<Record<string, number>>({});
  const [returnNote, setReturnNote] = useState("");
  const [returnPending, setReturnPending] = useState(false);

  function setReturnQty(itemId: string, qty: number) {
    setReturnQtys((prev) => ({ ...prev, [itemId]: qty }));
  }

  async function handleReturn() {
    const items = Object.entries(returnQtys)
      .filter(([, qty]) => qty > 0)
      .map(([saleItemId, quantity]) => ({ saleItemId, quantity }));

    if (items.length === 0) {
      toast.error("Enter quantities to return");
      return;
    }

    setReturnPending(true);
    const result = await returnSaleItems(
      saleId,
      items,
      returnNote || undefined
    );
    setReturnPending(false);

    if (result.success) {
      toast.success("Return processed successfully");
      setReturnOpen(false);
      setReturnQtys({});
      setReturnNote("");
    } else {
      toast.error(result.error ?? "Failed to process return");
    }
  }

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
          <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
            <DialogTrigger className="inline-flex items-center justify-center rounded-lg border px-2.5 h-8 text-sm font-medium hover:bg-muted">
              <RotateCcw className="h-4 w-4 mr-2" />
              Process Return
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Process Return</DialogTitle>
                <DialogDescription>
                  Enter the quantity to return for each item.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {sale.items
                  .filter((i: any) => i.returnedQuantity < i.quantity)
                  .map((item: any) => {
                    const maxReturn = item.quantity - item.returnedQuantity;
                    return (
                      <div
                        key={item._id}
                        className="flex items-center justify-between gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {item.productName}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Sold: {item.quantity} | Already returned:{" "}
                            {item.returnedQuantity} | Max: {maxReturn}
                          </p>
                        </div>
                        <Input
                          type="number"
                          min={0}
                          max={maxReturn}
                          value={returnQtys[item._id] ?? 0}
                          onChange={(e) =>
                            setReturnQty(
                              item._id,
                              Math.min(Number(e.target.value), maxReturn)
                            )
                          }
                          className="w-20"
                        />
                      </div>
                    );
                  })}
                <div className="space-y-2">
                  <Label>Note (optional)</Label>
                  <Input
                    value={returnNote}
                    onChange={(e) => setReturnNote(e.target.value)}
                    placeholder="Reason for return"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleReturn}
                  disabled={returnPending}
                >
                  {returnPending ? "Processing..." : "Confirm Return"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">
              {formatCurrency(sale.totalAmount)}
            </p>
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
      </div>

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
              {sale.items.map((item: any) => (
                <TableRow key={item._id}>
                  <TableCell className="font-medium">
                    {item.productName}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
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
                    {formatCurrency(item.totalPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
