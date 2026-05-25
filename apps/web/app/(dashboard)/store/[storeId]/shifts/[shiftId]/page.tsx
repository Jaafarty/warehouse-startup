"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { closeShift, reopenShift } from "@/app/actions/shifts";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowLeft, Clock, Lock, Unlock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

const TYPE_LABEL: Record<string, string> = {
  sale: "Sale",
  return: "Return",
  change_out: "Change given",
  manual_in: "Cash in",
  manual_out: "Cash out",
  reopen_adjustment: "Reopened",
};

export default function ShiftDetailPage() {
  const { storeId, shiftId } = useParams<{
    storeId: string;
    shiftId: string;
  }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const fns = store?.effectivePermissions?.shifts?.functions ?? {};
  const can = (fn: string) => isPrivileged || (fns[fn] ?? false);

  const shift = useQuery(
    api.shifts.get,
    userId ? { shiftId: shiftId as Id<"shifts">, userId } : "skip"
  );

  const [closeOpen, setCloseOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [countedUSD, setCountedUSD] = useState("");
  const [countedLBP, setCountedLBP] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  if (shift === undefined) {
    return (
      <div
        style={{ padding: "var(--wh-density-pad)" }}
        className="space-y-5"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (shift === null) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-4">
        <Link href={`/store/${storeId}/shifts`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to shifts
          </Button>
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Shift not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const totals = shift.totals;
  const isOwn = shift.openedBy === userId;
  const isOpen = shift.status === "open";
  const expectedUSD = isOpen
    ? totals.expectedClosingUSD
    : shift.expectedClosingUSD ?? totals.expectedClosingUSD;
  const expectedLBP = isOpen
    ? totals.expectedClosingLBP
    : shift.expectedClosingLBP ?? totals.expectedClosingLBP;

  const previewUSD = Number(countedUSD || "0");
  const previewLBP = Number(countedLBP || "0");
  const previewDiscUSD = previewUSD - totals.expectedClosingUSD;
  const previewDiscLBP = previewLBP - totals.expectedClosingLBP;
  const previewHasDisc =
    Math.abs(previewDiscUSD) > 0.005 || Math.abs(previewDiscLBP) >= 1;

  async function handleClose() {
    if (countedUSD === "" || countedLBP === "") {
      toast.error("Counted USD and LBP are required.");
      return;
    }
    setClosing(true);
    const res = await closeShift(
      shiftId,
      Number(countedUSD),
      Number(countedLBP),
      closeNote
    );
    setClosing(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to close shift");
      return;
    }
    toast.success("Shift closed");
    setCloseOpen(false);
    setCountedUSD("");
    setCountedLBP("");
    setCloseNote("");
  }

  async function handleReopen() {
    if (!reopenReason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setReopening(true);
    const res = await reopenShift(shiftId, reopenReason);
    setReopening(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to reopen shift");
      return;
    }
    toast.success("Shift reopened");
    setReopenReason("");
    setReopenOpen(false);
  }

  // Cashier closes own shift with close_shift. Owner/admin can close any
  // cashier's open shift on their behalf (backend enforces the same in
  // shifts.close).
  const canClose =
    isOpen && ((isOwn && can("close_shift")) || (!isOwn && isPrivileged));
  const closingForOther = canClose && !isOwn;
  const canReopen = !isOpen && can("reopen_shift");

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Clock}
        title={
          <div className="flex items-center gap-2">
            <span>Shift</span>
            <Badge variant={isOpen ? "default" : "secondary"}>
              {shift.status}
            </Badge>
          </div>
        }
        subtitle={
          <>
            {shift.registerName && (
              <span className="font-medium text-foreground">
                {shift.registerName} ·{" "}
              </span>
            )}
            Opened {formatDate(shift.openedAt)} by {shift.openedByName}
            {shift.closedAt &&
              ` · Closed ${formatDate(shift.closedAt)}${
                shift.closedByName ? ` by ${shift.closedByName}` : ""
              }`}
          </>
        }
        right={
          <>
            {canReopen && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setReopenOpen(true)}
              >
                <Unlock className="h-4 w-4 mr-1.5" />
                Reopen
              </Button>
            )}
            {canClose && (
              <Button
                size="sm"
                onClick={() => setCloseOpen(true)}
                style={{
                  background: "var(--destructive)",
                  color: "#ffffff",
                }}
              >
                <Lock className="h-4 w-4 mr-1.5" />
                Close shift
              </Button>
            )}
          </>
        }
      />

      {/* Balance breakdown */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold">Drawer balance</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Opening + sales + cash in − refunds − cash out − change given.
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">LBP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <BalanceRow
                label="Opening"
                usd={shift.openingUSD}
                lbp={shift.openingLBP}
              />
              <BalanceRow
                label="+ Sales"
                usd={totals.salesUSD}
                lbp={totals.salesLBP}
                positive
              />
              <BalanceRow
                label="− Refunds"
                usd={totals.returnsUSD}
                lbp={totals.returnsLBP}
              />
              <BalanceRow
                label="+ Cash in"
                usd={totals.manualInUSD}
                lbp={totals.manualInLBP}
                positive
              />
              <BalanceRow
                label="− Cash out"
                usd={totals.manualOutUSD}
                lbp={totals.manualOutLBP}
              />
              <BalanceRow
                label="− Change given"
                usd={totals.changeOutUSD}
                lbp={totals.changeOutLBP}
              />
              <TableRow className="border-t-2 font-medium">
                <TableCell>Expected closing</TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(expectedUSD, "USD")}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatCurrency(expectedLBP, "LBP")}
                </TableCell>
              </TableRow>
              {!isOpen && (
                <>
                  <TableRow>
                    <TableCell>Counted</TableCell>
                    <TableCell className="text-right font-mono">
                      {shift.countedUSD !== undefined
                        ? formatCurrency(shift.countedUSD, "USD")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {shift.countedLBP !== undefined
                        ? formatCurrency(shift.countedLBP, "LBP")
                        : "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow className="font-medium">
                    <TableCell>Discrepancy</TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        Math.abs(shift.discrepancyUSD ?? 0) > 0.005
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {(shift.discrepancyUSD ?? 0) >= 0 ? "+" : ""}
                      {formatCurrency(shift.discrepancyUSD ?? 0, "USD")}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        Math.abs(shift.discrepancyLBP ?? 0) >= 1
                          ? "text-destructive"
                          : ""
                      }`}
                    >
                      {(shift.discrepancyLBP ?? 0) >= 0 ? "+" : ""}
                      {formatCurrency(shift.discrepancyLBP ?? 0, "LBP")}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
          {!isOpen && shift.discrepancyNote && (
            <div className="mx-6 my-4 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Discrepancy note</p>
              <p className="mt-0.5 whitespace-pre-wrap">
                {shift.discrepancyNote}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash events */}
      <Card>
        <CardContent className="p-0">
          <div className="px-6 pt-5 pb-3">
            <h3 className="text-[15px] font-semibold">Cash events</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every drawer movement during this shift, newest first.
            </p>
          </div>
          {shift.events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No activity yet</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Events will appear here as sales, returns, and cash entries
                land.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">USD</TableHead>
                  <TableHead className="text-right">LBP</TableHead>
                  <TableHead>Reason / ref</TableHead>
                  <TableHead>By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shift.events.map((e) => (
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
                    <TableCell className="max-w-[200px] truncate text-sm">
                      {e.reason ??
                        (e.referenceType === "sale"
                          ? "Sale"
                          : e.referenceType === "sale_return"
                            ? "Return"
                            : "—")}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.performedByName}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Close shift drawer */}
      <Sheet open={closeOpen} onOpenChange={setCloseOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md p-0 gap-0"
        >
          <div
            className="h-1 w-full flex-shrink-0"
            style={{ background: "var(--destructive)" }}
          />
          <SheetHeader className="p-6 pb-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg flex-shrink-0"
                style={{
                  background: "oklch(0.94 0.04 27)",
                  color: "var(--destructive)",
                }}
              >
                <Lock className="h-5 w-5" />
              </div>
              <div className="flex flex-col text-left">
                <SheetTitle className="text-[17px] tracking-tight">
                  Close shift
                </SheetTitle>
                <SheetDescription className="text-[12px]">
                  {closingForOther
                    ? `Closing on behalf of ${shift.openedByName}. Count the drawer and record the closing balance.`
                    : "Count the drawer and record the closing balance."}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Expected USD
                </p>
                <p className="font-mono font-semibold mt-0.5">
                  {formatCurrency(totals.expectedClosingUSD, "USD")}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Expected LBP
                </p>
                <p className="font-mono font-semibold mt-0.5">
                  {formatCurrency(totals.expectedClosingLBP, "LBP")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="counted-usd"
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Counted USD
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="counted-usd"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={countedUSD}
                    onChange={(e) => setCountedUSD(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 h-12 text-xl font-mono font-bold tracking-tight"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="counted-lbp"
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  Counted LBP
                </Label>
                <Input
                  id="counted-lbp"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="decimal"
                  value={countedLBP}
                  onChange={(e) => setCountedLBP(e.target.value)}
                  placeholder="0"
                  className="h-12 text-xl font-mono font-bold tracking-tight"
                />
              </div>
            </div>

            {previewHasDisc &&
              (countedUSD !== "" || countedLBP !== "") && (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm space-y-1">
                  <p className="font-medium text-destructive">
                    Discrepancy: {previewDiscUSD >= 0 ? "+" : ""}
                    {formatCurrency(previewDiscUSD, "USD")} ·{" "}
                    {previewDiscLBP >= 0 ? "+" : ""}
                    {formatCurrency(previewDiscLBP, "LBP")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A note explaining the variance is required.
                  </p>
                </div>
              )}

            <div className="space-y-1.5">
              <Label
                htmlFor="close-note"
                className="text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                Note{" "}
                {previewHasDisc && (
                  <span className="text-destructive normal-case">*</span>
                )}
              </Label>
              <Textarea
                id="close-note"
                value={closeNote}
                onChange={(e) => setCloseNote(e.target.value)}
                placeholder="Reason if there is a discrepancy"
                rows={2}
              />
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t p-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCloseOpen(false)}
              disabled={closing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClose}
              disabled={closing}
              style={{
                background: "var(--destructive)",
                color: "#ffffff",
              }}
            >
              <Lock className="h-4 w-4 mr-1.5" />
              {closing ? "Closing…" : "Close shift"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reopen shift dialog */}
      <AlertDialog open={reopenOpen} onOpenChange={setReopenOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reopen this shift?</AlertDialogTitle>
            <AlertDialogDescription>
              Closed totals will be cleared. The reason is recorded in the
              audit log and as a cash event on the shift.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label
              htmlFor="reopen-reason"
              className="text-[10px] uppercase tracking-wider text-muted-foreground"
            >
              Reason
            </Label>
            <Textarea
              id="reopen-reason"
              value={reopenReason}
              onChange={(e) => setReopenReason(e.target.value)}
              placeholder="Why are you reopening this shift?"
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reopening}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleReopen} disabled={reopening}>
              {reopening ? "Reopening…" : "Reopen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BalanceRow({
  label,
  usd,
  lbp,
  positive = false,
}: {
  label: string;
  usd: number;
  lbp: number;
  positive?: boolean;
}) {
  const usdClass =
    usd === 0
      ? "text-muted-foreground"
      : positive
        ? "text-[color:var(--color-success)]"
        : "";
  const lbpClass =
    lbp === 0
      ? "text-muted-foreground"
      : positive
        ? "text-[color:var(--color-success)]"
        : "";
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className={`text-right font-mono ${usdClass}`}>
        {formatCurrency(usd, "USD")}
      </TableCell>
      <TableCell className={`text-right font-mono ${lbpClass}`}>
        {formatCurrency(lbp, "LBP")}
      </TableCell>
    </TableRow>
  );
}
