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
import { formatCurrency } from "@ware-house/shared";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useState } from "react";

type Row = {
  productId: string;
  name: string;
  qtySold: number;
  revenue: number;
  orderCount: number;
};

type SortKey = "name" | "qtySold" | "revenue" | "orderCount";
type SortDir = "asc" | "desc";

export function TopProductsTable({ data }: { data: Row[] | undefined }) {
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

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
        No product sales in this range.
      </div>
    );
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (typeof av === "number" && typeof bv === "number") {
      return sortDir === "asc" ? av - bv : bv - av;
    }
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const toggle = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "name" ? "asc" : "desc");
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <HeaderBtn k="name" label="Product" />
          </TableHead>
          <TableHead className="text-right">
            <HeaderBtn k="qtySold" label="Qty Sold" right />
          </TableHead>
          <TableHead className="text-right">
            <HeaderBtn k="revenue" label="Revenue" right />
          </TableHead>
          <TableHead className="text-right">
            <HeaderBtn k="orderCount" label="Orders" right />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow key={row.productId}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-right tabular-nums">
              {row.qtySold.toLocaleString()}
            </TableCell>
            <TableCell className="text-right tabular-nums font-medium">
              {formatCurrency(row.revenue)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {row.orderCount}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
