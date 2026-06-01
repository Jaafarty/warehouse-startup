"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@ware-house/shared";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";

export type DailyRow = {
  date: string;
  orders: number;
  revenue: number;
  avgOrderValue: number;
};

type SortKey = "date" | "orders" | "revenue" | "avgOrderValue";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 30;

function dateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DailySummaryTable({ data }: { data: DailyRow[] | undefined }) {
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  if (!data) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        No sales in this range.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => {
    if (sortKey === "date") {
      return sortDir === "asc"
        ? a.date.localeCompare(b.date)
        : b.date.localeCompare(a.date);
    }
    return sortDir === "asc"
      ? a[sortKey] - b[sortKey]
      : b[sortKey] - a[sortKey];
  });

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const slice = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const HeaderBtn = ({ k, label, right }: { k: SortKey; label: string; right?: boolean }) => {
    const Icon =
      sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggle(k)}
        className={`flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground ${right ? "ml-auto" : ""}`}
      >
        {label}
        <Icon className="h-3 w-3" />
      </button>
    );
  };

  return (
    <div className="flex flex-col">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <HeaderBtn k="date" label="Date" />
            </TableHead>
            <TableHead className="text-right">
              <HeaderBtn k="orders" label="Orders" right />
            </TableHead>
            <TableHead className="text-right">
              <HeaderBtn k="revenue" label="Revenue" right />
            </TableHead>
            <TableHead className="text-right">
              <HeaderBtn k="avgOrderValue" label="Avg Order" right />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {slice.map((row) => (
            <TableRow key={row.date}>
              <TableCell className="font-medium">{dateLabel(row.date)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.orders}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                {formatCurrency(row.revenue)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(row.avgOrderValue)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 ? (
        <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
          <span>
            Page {safePage + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
