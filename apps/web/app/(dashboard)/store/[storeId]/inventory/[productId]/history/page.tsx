"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatDate } from "@ware-house/shared";
import { ArrowLeft, ArrowUp, ArrowDown, RotateCcw } from "lucide-react";
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
    return <RotateCcw className="h-4 w-4 text-blue-500" />;
  }
  return <ArrowUp className="h-4 w-4 text-green-600" />;
}

export default function StockHistoryPage() {
  const { storeId, productId } = useParams<{
    storeId: string;
    productId: string;
  }>();
  const { userId } = useCurrentUser();

  const product = useQuery(
    api.products.get,
    userId
      ? { productId: productId as any, userId: userId as any }
      : "skip"
  );

  const movements = useQuery(
    api.stockMovements.listByProduct,
    userId
      ? { productId: productId as any, userId: userId as any }
      : "skip"
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/inventory/${productId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Stock History</h1>
          <p className="text-muted-foreground">
            {product ? product.name : "Loading..."}
            {product && (
              <span className="ml-2">
                — Current stock: <strong>{product.quantity}</strong>
              </span>
            )}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Movement Log</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {movements === undefined ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              No stock movements recorded yet.
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
                {movements.map((m: any) => (
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
                          ? "text-green-600"
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
  );
}
