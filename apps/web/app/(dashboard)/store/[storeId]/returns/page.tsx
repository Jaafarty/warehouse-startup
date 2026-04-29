"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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

const REASON_LABEL: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong item",
  damaged_in_transit: "Damaged in transit",
  customer_changed_mind: "Customer changed mind",
  other: "Other",
};

export default function ReturnsListPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fromMs = fromDate ? new Date(fromDate).getTime() : undefined;
  // include the end-of-day for `toDate`
  const toMs = toDate
    ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1
    : undefined;

  const returns = useQuery(
    api.returns.listByStore,
    userId
      ? {
          storeId: storeId as any,
          userId: userId as any,
          search: search || undefined,
          reason: reasonFilter !== "all" ? (reasonFilter as any) : undefined,
          fromDate: fromMs,
          toDate: toMs,
        }
      : "skip"
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returns</h1>
        <p className="text-muted-foreground">
          {returns
            ? `${returns.length} return${returns.length !== 1 ? "s" : ""}`
            : "Loading..."}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search return #, sale #, customer name or phone"
            className="pl-8"
          />
        </div>
        <Select
          value={reasonFilter}
          onValueChange={(v) => setReasonFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All reasons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {Object.entries(REASON_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v} label={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {returns === undefined ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RotateCcw className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No returns</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Returns will appear here once they're processed.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
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
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/store/${storeId}/sales/${r.saleId}`}
                        className="font-mono hover:underline"
                      >
                        {r.saleNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.customerName ? (
                        <div>
                          <p className="font-medium">{r.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.customerPhone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Walk-in</span>
                      )}
                    </TableCell>
                    <TableCell>{REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.totalRefund)}
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
