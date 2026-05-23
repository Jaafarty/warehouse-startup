"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { Plus, Clock, Info, CircleDot, CircleSlash } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

  const [tab, setTab] = useState<"mine" | "all">("mine");

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

  if (store && !store.shiftsEnabled) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="max-w-3xl space-y-4">
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

  const mineCount = minePage?.page?.length ?? 0;
  const allCount = allPage?.page?.length ?? 0;

  return (
    <div
      style={{ padding: "var(--wh-density-pad)" }}
      className="space-y-5"
    >
      <PageHeader
        icon={Clock}
        title="Shifts"
        subtitle="Cashier sessions and drawer reconciliation."
        right={
          canOpen && !active && (
            <Link href={`/store/${storeId}/shifts/new`}>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1.5" />
                Open shift
              </Button>
            </Link>
          )
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {active && (
            <Card className="border-primary/40">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Active shift
                    </CardTitle>
                    <CardDescription>
                      Opened {formatDate(active.openedAt)}
                    </CardDescription>
                  </div>
                  <Badge variant="default">Open</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-muted-foreground">Opening USD</p>
                    <p className="font-mono font-medium">
                      {formatCurrency(active.openingUSD, "USD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Opening LBP</p>
                    <p className="font-mono font-medium">
                      {formatCurrency(active.openingLBP, "LBP")}
                    </p>
                  </div>
                </div>
                <Link href={`/store/${storeId}/shifts/${active._id}`}>
                  <Button variant="outline" size="sm">
                    Manage shift
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          <Tabs
            value={tab}
            onValueChange={(v) => setTab((v ?? "mine") as "mine" | "all")}
          >
            <TabsList>
              <TabsTrigger value="mine">My shifts</TabsTrigger>
              {canViewAll && <TabsTrigger value="all">All shifts</TabsTrigger>}
            </TabsList>

            <TabsContent value="mine">
              <ShiftTable
                storeId={storeId}
                page={minePage?.page}
                loading={minePage === undefined}
                showCashier={false}
              />
            </TabsContent>
            {canViewAll && (
              <TabsContent value="all">
                <ShiftTable
                  storeId={storeId}
                  page={allPage?.page}
                  loading={allPage === undefined}
                  showCashier
                />
              </TabsContent>
            )}
          </Tabs>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">At a glance</CardTitle>
              <CardDescription>Drawer status right now.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  {active ? (
                    <CircleDot className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <CircleSlash className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  Status
                </span>
                <span className="font-medium">
                  {active ? "Active" : "No open shift"}
                </span>
              </div>
              {active && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Opened</span>
                    <span>{formatDate(active.openedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Opening USD</span>
                    <span className="font-mono">
                      {formatCurrency(active.openingUSD, "USD")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Opening LBP</span>
                    <span className="font-mono">
                      {formatCurrency(active.openingLBP, "LBP")}
                    </span>
                  </div>
                </>
              )}
              <div className="border-t pt-3 flex items-center justify-between">
                <span className="text-muted-foreground">My shifts shown</span>
                <span className="font-mono">{mineCount}</span>
              </div>
              {canViewAll && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">All shifts shown</span>
                  <span className="font-mono">{allCount}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4 text-muted-foreground" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>Count the drawer before opening and again before closing.</p>
              <p>
                Discrepancies above a few cents or 1 LBP require a note for
                audit.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
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
  loading,
  showCashier,
}: {
  storeId: string;
  page: ShiftRow[] | undefined;
  loading: boolean;
  showCashier: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 mt-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    );
  }
  if (!page || page.length === 0) {
    return (
      <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">
        No shifts yet.
      </div>
    );
  }
  return (
    <div className="rounded-md border mt-4">
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
                {showCashier && <TableCell>{s.openedByName ?? "—"}</TableCell>}
                <TableCell>
                  <Badge variant={s.status === "open" ? "default" : "secondary"}>
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
    </div>
  );
}
