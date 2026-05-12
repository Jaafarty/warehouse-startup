"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { Plus, ShoppingCart, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "returned" | "partially_returned">("all");
  const [search, setSearch] = useState<string>("");

  const sales = useQuery(
    api.sales.list,
    userId
      ? {
          storeId: storeId as Id<"stores">,
          userId,
          status: statusFilter !== "all" ? statusFilter : undefined,
          search: search || undefined,
        }
      : "skip"
  );

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const canCreateSale =
    isPrivileged || (store?.effectivePermissions?.sales?.functions?.create_sale ?? false);

  const rate = useQuery(
    api.exchangeRates.getCurrent,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const canSetRate =
    isPrivileged ||
    (store?.effectivePermissions?.exchange_rate?.functions?.set_rate ?? false);
  const rateMissing = rate === null;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sales</h1>
          <p className="text-muted-foreground">
            {sales ? `${sales.length} sale${sales.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        {canCreateSale && (
          rateMissing ? (
            <Button size="sm" disabled title="Set the exchange rate first">
              <Plus className="h-4 w-4 mr-2" />
              New Sale
            </Button>
          ) : (
            <Link href={`/store/${storeId}/sales/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Sale
              </Button>
            </Link>
          )
        )}
      </div>

      {rateMissing && (
        <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="py-4 text-sm flex items-center justify-between gap-4">
            <p>
              No exchange rate set. Sales are blocked until an owner or admin sets one.
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sale #, customer name or phone"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter((v ?? "all") as "all" | "completed" | "returned" | "partially_returned")}
        >
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
              {canCreateSale && (
                rateMissing ? (
                  <Button disabled title="Set the exchange rate first">
                    <Plus className="h-4 w-4 mr-2" />
                    New Sale
                  </Button>
                ) : (
                  <Link href={`/store/${storeId}/sales/new`}>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      New Sale
                    </Button>
                  </Link>
                )
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale #</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Created By</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
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
                    <TableCell>
                      {sale.customerName ? (
                        <div>
                          <p className="font-medium">{sale.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.customerPhone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Walk-in</span>
                      )}
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
