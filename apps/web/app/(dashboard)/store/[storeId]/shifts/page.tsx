"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { Plus, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const PAGE_SIZE = 20;

type Scope = "mine" | "all";

export default function ShiftsListPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const fns = store?.effectivePermissions?.shifts?.functions ?? {};
  const can = (fn: string) => isPrivileged || (fns[fn] ?? false);
  const canViewAll = can("view_all");
  const canOpen = can("open_shift");

  const active = useQuery(
    api.shifts.getActive,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const [scope, setScope] = useState<Scope>("mine");

  const minePage = useQuery(
    api.shifts.listMine,
    userId
      ? {
          storeId: storeId as Id<"stores">,
          userId,
          paginationOpts: { numItems: PAGE_SIZE, cursor: null },
        }
      : "skip"
  );
  const allPage = useQuery(
    api.shifts.listAll,
    userId && canViewAll
      ? {
          storeId: storeId as Id<"stores">,
          userId,
          paginationOpts: { numItems: PAGE_SIZE, cursor: null },
        }
      : "skip"
  );

  const currentPage = scope === "all" ? allPage : minePage;
  const shifts = currentPage?.page;
  const loading = currentPage === undefined;
  const count = shifts?.length ?? 0;

  if (store && !store.shiftsEnabled) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
        <PageHeader
          icon={Clock}
          title="Shifts"
          subtitle="Cashier sessions and drawer reconciliation."
        />
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground flex items-center justify-between gap-4">
            <p>The Shifts feature is disabled for this store.</p>
            {isPrivileged && (
              <Link href={`/store/${storeId}/settings`}>
                <Button variant="outline" size="sm">
                  Enable in settings
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Clock}
        title="Shifts"
        subtitle={
          loading
            ? "Loading..."
            : `${count} shift${count !== 1 ? "s" : ""}`
        }
        right={
          canOpen && !active && (
            <Link href={`/store/${storeId}/shifts/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Open shift
              </Button>
            </Link>
          )
        }
      />

      {active && (
        <Card
          style={{
            borderColor: "var(--primary)",
            background: "var(--primary-soft, var(--accent))",
          }}
        >
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-md flex-shrink-0"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[15px] font-semibold">
                    Active shift
                  </span>
                  <Badge variant="default">Open</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Opened {formatDate(active.openedAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Opening USD
                </div>
                <div className="font-mono text-[15px] font-semibold">
                  {formatCurrency(active.openingUSD, "USD")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Opening LBP
                </div>
                <div className="font-mono text-[15px] font-semibold">
                  {formatCurrency(active.openingLBP, "LBP")}
                </div>
              </div>
              <Link href={`/store/${storeId}/shifts/${active._id}`}>
                <Button variant="outline" size="sm">
                  Manage shift
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {canViewAll && (
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedScope value={scope} onChange={setScope} />
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : !shifts || shifts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No shifts yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {canOpen
                  ? "Open a shift to start tracking your drawer."
                  : "Shifts will appear here once a cashier opens one."}
              </p>
              {canOpen && !active && (
                <Link href={`/store/${storeId}/shifts/new`}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Open shift
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <ShiftTable
              storeId={storeId}
              page={shifts}
              showCashier={scope === "all"}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SegmentedScope({
  value,
  onChange,
}: {
  value: Scope;
  onChange: (v: Scope) => void;
}) {
  const options: { v: Scope; label: string }[] = [
    { v: "mine", label: "My shifts" },
    { v: "all", label: "All shifts" },
  ];
  return (
    <div
      className="inline-flex p-[3px] gap-0.5 rounded-lg border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="h-[30px] px-3.5 rounded-md text-[12px] font-semibold border-none cursor-pointer transition"
            style={{
              background: active ? "var(--secondary)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

type ShiftRow = {
  _id: Id<"shifts">;
  status: "open" | "closed";
  openedAt: number;
  closedAt?: number;
  openingUSD: number;
  openingLBP: number;
  countedUSD?: number;
  countedLBP?: number;
  discrepancyUSD?: number;
  discrepancyLBP?: number;
  openedByName?: string;
};

function ShiftTable({
  storeId,
  page,
  showCashier,
}: {
  storeId: string;
  page: ShiftRow[];
  showCashier: boolean;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Opened</TableHead>
          {showCashier && <TableHead>Cashier</TableHead>}
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Opening (USD)</TableHead>
          <TableHead className="text-right">Counted (USD)</TableHead>
          <TableHead className="text-right">Discrepancy</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {page.map((s) => {
          const dUSD = s.discrepancyUSD ?? 0;
          const dLBP = s.discrepancyLBP ?? 0;
          const hasDisc =
            s.status === "closed" &&
            (Math.abs(dUSD) > 0.005 || Math.abs(dLBP) >= 1);
          return (
            <TableRow key={s._id}>
              <TableCell className="text-sm whitespace-nowrap">
                {formatDate(s.openedAt)}
              </TableCell>
              {showCashier && (
                <TableCell>{s.openedByName ?? "—"}</TableCell>
              )}
              <TableCell>
                <Badge
                  variant={s.status === "open" ? "default" : "secondary"}
                >
                  {s.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(s.openingUSD, "USD")}
              </TableCell>
              <TableCell className="text-right font-mono">
                {s.countedUSD !== undefined
                  ? formatCurrency(s.countedUSD, "USD")
                  : "—"}
              </TableCell>
              <TableCell
                className={`text-right font-mono text-sm ${
                  hasDisc ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {s.status === "closed"
                  ? `${dUSD >= 0 ? "+" : ""}${formatCurrency(dUSD, "USD")}`
                  : "—"}
              </TableCell>
              <TableCell className="text-right">
                <Link href={`/store/${storeId}/shifts/${s._id}`}>
                  <Button variant="ghost" size="sm">
                    View
                  </Button>
                </Link>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
