"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { recordCash } from "@/app/actions/shifts";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowDownCircle, ArrowUpCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
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
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  manual_in: "Cash in",
  manual_out: "Cash out",
};

export default function CashPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const fns = store?.effectivePermissions?.cash?.functions ?? {};
  const can = (fn: string) => isPrivileged || (fns[fn] ?? false);
  const canRecordIn = can("record_in");
  const canRecordOut = can("record_out");

  const drawer = useQuery(
    api.shifts.getStoreDrawer,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const activeShift = useQuery(
    api.shifts.getActive,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const shiftDetail = useQuery(
    api.shifts.get,
    userId && activeShift ? { shiftId: activeShift._id, userId } : "skip"
  );

  const cashEvents = useQuery(
    api.shifts.listStoreCashEvents,
    userId
      ? { storeId: storeId as Id<"stores">, userId, limit: 100 }
      : "skip"
  );

  const writeAllowedDirections: Array<"in" | "out"> = [];
  if (canRecordIn) writeAllowedDirections.push("in");
  if (canRecordOut) writeAllowedDirections.push("out");

  const [direction, setDirection] = useState<"in" | "out">("in");
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    const usdNum = Number(usd || "0");
    const lbpNum = Number(lbp || "0");
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    if (usdNum === 0 && lbpNum === 0) {
      toast.error("Enter an amount in USD or LBP");
      return;
    }
    setSubmitting(true);
    const res = await recordCash(storeId, direction, usdNum, lbpNum, reason);
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to record");
      return;
    }
    toast.success("Recorded");
    setUsd("");
    setLbp("");
    setReason("");
  }

  const drawerUSD = drawer?.drawerUSD ?? 0;
  const drawerLBP = drawer?.drawerLBP ?? 0;

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Wallet className="h-6 w-6" />
          Cash
        </h1>
        <p className="text-muted-foreground">
          Store drawer balance and paid-in / paid-out events.
        </p>
      </div>

      {drawer === undefined ? (
        <Skeleton className="h-24" />
      ) : (
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Store drawer balance</CardTitle>
            <CardDescription>
              Running total across all shifts and standalone events.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">USD</p>
              <p className="font-mono text-2xl font-bold">
                {formatCurrency(drawerUSD, "USD")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">LBP</p>
              <p className="font-mono text-2xl font-bold">
                {formatCurrency(drawerLBP, "LBP")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeShift && shiftDetail && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Active shift sub-total</CardTitle>
                <CardDescription>
                  Opened {formatDate(activeShift.openedAt)}.
                </CardDescription>
              </div>
              <Link href={`/store/${storeId}/shifts/${activeShift._id}`}>
                <Button variant="outline" size="sm">
                  View shift
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Shift USD</p>
              <p className="font-mono text-xl font-medium">
                {formatCurrency(shiftDetail.totals.expectedClosingUSD, "USD")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Shift LBP</p>
              <p className="font-mono text-xl font-medium">
                {formatCurrency(shiftDetail.totals.expectedClosingLBP, "LBP")}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {writeAllowedDirections.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Record cash event</CardTitle>
            <CardDescription>
              Petty cash, change-fund top-up, etc. Reason is required.
              {activeShift ? " Tagged to your active shift." : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div className="space-y-1">
                <Label>Direction</Label>
                <Select
                  value={direction}
                  onValueChange={(v) =>
                    setDirection((v ?? writeAllowedDirections[0]) as "in" | "out")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {canRecordIn && (
                      <SelectItem value="in" label="Paid in">
                        <span className="inline-flex items-center gap-1.5">
                          <ArrowDownCircle className="h-4 w-4 text-green-600" />
                          Paid in
                        </span>
                      </SelectItem>
                    )}
                    {canRecordOut && (
                      <SelectItem value="out" label="Paid out">
                        <span className="inline-flex items-center gap-1.5">
                          <ArrowUpCircle className="h-4 w-4 text-destructive" />
                          Paid out
                        </span>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cash-usd">USD</Label>
                <Input
                  id="cash-usd"
                  type="number"
                  step="0.01"
                  min="0"
                  value={usd}
                  onChange={(e) => setUsd(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cash-lbp">LBP</Label>
                <Input
                  id="cash-lbp"
                  type="number"
                  step="1"
                  min="0"
                  value={lbp}
                  onChange={(e) => setLbp(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cash-reason">Reason</Label>
                <Input
                  id="cash-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Lunch petty cash"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSubmit} disabled={submitting} size="sm">
                {submitting ? "Saving..." : "Record"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent cash events</CardTitle>
          <CardDescription>
            Paid-in / paid-out activity across the store.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {cashEvents === undefined ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : cashEvents.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              No cash events yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                  <TableHead className="text-right">LBP</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Shift</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashEvents.map((e) => (
                  <TableRow key={e._id}>
                    <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                      {formatDate(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {TYPE_LABEL[e.type] ?? e.type}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        e.amountUSD < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {e.amountUSD >= 0 ? "+" : ""}
                      {formatCurrency(e.amountUSD, "USD")}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        e.amountLBP < 0 ? "text-destructive" : ""
                      }`}
                    >
                      {e.amountLBP >= 0 ? "+" : ""}
                      {formatCurrency(e.amountLBP, "LBP")}
                    </TableCell>
                    <TableCell className="text-sm">{e.reason ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.performedByName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.shiftId ? (
                        <Link
                          href={`/store/${storeId}/shifts/${e.shiftId}`}
                          className="underline"
                        >
                          shift
                        </Link>
                      ) : (
                        "—"
                      )}
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
