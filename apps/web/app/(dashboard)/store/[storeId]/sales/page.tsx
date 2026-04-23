"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  partially_returned: "secondary",
  returned: "outline",
};

export default function SalesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const sales = useQuery(
    api.sales.list,
    userId
      ? {
          storeId: storeId as any,
          userId: userId as any,
          status: statusFilter !== "all" ? (statusFilter as any) : undefined,
        }
      : "skip"
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground">
            {sales ? `${sales.length} sale${sales.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        <Link href={`/store/${storeId}/sales/new`}>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Sale
          </Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="partially_returned">Partially Returned</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {sales === undefined ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : sales.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No sales yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Create your first sale to start tracking revenue.
              </p>
              <Link href={`/store/${storeId}/sales/new`}>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Sale
                </Button>
              </Link>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale: any) => (
                  <TableRow key={sale._id}>
                    <TableCell>
                      <Link
                        href={`/store/${storeId}/sales/${sale._id}`}
                        className="font-medium font-mono hover:underline"
                      >
                        {sale.saleNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{sale.itemCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(sale.totalAmount)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[sale.status] ?? "outline"}>
                        {sale.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {sale.createdByName}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(sale.createdAt)}
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
