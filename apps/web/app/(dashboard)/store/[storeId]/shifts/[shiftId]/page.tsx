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
import { ArrowLeft, Lock, Unlock, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
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

  // Close form state
  const [closeOpen, setCloseOpen] = useState(false);
  const [countedUSD, setCountedUSD] = useState("");
  const [countedLBP, setCountedLBP] = useState("");
  const [closeNote, setCloseNote] = useState("");
  const [closing, setClosing] = useState(false);

  // Reopen
  const [reopenReason, setReopenReason] = useState("");
  const [reopening, setReopening] = useState(false);

  if (shift === undefined) {
    return (
      <div className="p-6 max-w-4xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (shift === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Shift not found.</p>
        <Link href={`/store/${storeId}/shifts`}>
          <Button variant="link" className="px-0 mt-2">
            Back to shifts
          </Button>
        </Link>
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
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={`/store/${storeId}/shifts`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">Shift</h1>
              <Badge variant={isOpen ? "default" : "secondary"}>
                {shift.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Opened {formatDate(shift.openedAt)} by {shift.openedByName}
              {shift.closedAt &&
                ` · Closed ${formatDate(shift.closedAt)}${
                  shift.closedByName ? ` by ${shift.closedByName}` : ""
                }`}
            </p>
          </div>
        </div>

        {isOpen && isOwn && can("close_shift") && (
          <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
            <DialogTrigger className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90">
              <Lock className="h-4 w-4" />
              Close shift
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Close shift</DialogTitle>
                <DialogDescription>
                  Count the drawer and record the closing balance.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Expected USD</p>
                    <p className="font-mono font-medium">
                      {formatCurrency(totals.expectedClosingUSD, "USD")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expected LBP</p>
                    <p className="font-mono font-medium">
                      {formatCurrency(totals.expectedClosingLBP, "LBP")}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="counted-usd">Counted USD</Label>
                    <Input
                      id="counted-usd"
                      type="number"
                      step="0.01"
                      min="0"
                      value={countedUSD}
                      onChange={(e) => setCountedUSD(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="counted-lbp">Counted LBP</Label>
                    <Input
                      id="counted-lbp"
                      type="number"
                      step="1"
                      min="0"
                      value={countedLBP}
                      onChange={(e) => setCountedLBP(e.target.value)}
                    />
                  </div>
                </div>

                {previewHasDisc && (countedUSD !== "" || countedLBP !== "") && (
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

                <div className="space-y-1">
                  <Label htmlFor="close-note">
                    Note {previewHasDisc && <span className="text-destructive">*</span>}
                  </Label>
                  <Textarea
                    id="close-note"
                    value={closeNote}
                    onChange={(e) => setCloseNote(e.target.value)}
                    placeholder="Reason if there is a discrepancy"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setCloseOpen(false)}
                    disabled={closing}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleClose} disabled={closing}>
                    {closing ? "Closing..." : "Close shift"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {!isOpen && can("reopen_shift") && (
          <AlertDialog>
            <AlertDialogTrigger className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent">
              <Unlock className="h-4 w-4" />
              Reopen
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reopen this shift?</AlertDialogTitle>
                <AlertDialogDescription>
                  Closed totals will be cleared. The reason is recorded in the
                  audit log and as a cash event on the shift.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-1">
                <Label htmlFor="reopen-reason">Reason</Label>
                <Textarea
                  id="reopen-reason"
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  placeholder="Why are you reopening this shift?"
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={reopening}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleReopen}
                  disabled={reopening}
                >
                  {reopening ? "Reopening..." : "Reopen"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      {/* Balance breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Drawer balance</CardTitle>
          <CardDescription>
            Opening + sales + cash in − refunds − cash out − change given.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead />
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">LBP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <BalanceRow label="Opening" usd={shift.openingUSD} lbp={shift.openingLBP} />
              <BalanceRow label="+ Sales" usd={totals.salesUSD} lbp={totals.salesLBP} positive />
              <BalanceRow label="− Refunds" usd={totals.returnsUSD} lbp={totals.returnsLBP} />
              <BalanceRow label="+ Cash in" usd={totals.manualInUSD} lbp={totals.manualInLBP} positive />
              <BalanceRow label="− Cash out" usd={totals.manualOutUSD} lbp={totals.manualOutLBP} />
              <BalanceRow label="− Change given" usd={totals.changeOutUSD} lbp={totals.changeOutLBP} />
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
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
              <p className="text-xs text-muted-foreground">Discrepancy note</p>
              <p className="mt-0.5 whitespace-pre-wrap">{shift.discrepancyNote}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash management lives on its own page now — quick link for the open shift owner. */}
      {isOpen && isOwn && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 flex items-center justify-between">
          <div className="text-sm">
            <p className="font-medium">Need to record paid-in / paid-out?</p>
            <p className="text-muted-foreground text-xs">
              Cash events live on the Cash page now.
            </p>
          </div>
          <Link href={`/store/${storeId}/cash`}>
            <Button variant="outline" size="sm">
              <Wallet className="h-4 w-4 mr-1.5" />
              Open Cash page
            </Button>
          </Link>
        </div>
      )}

      {/* Events log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cash events</CardTitle>
          <CardDescription>
            Every drawer movement during this shift, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {shift.events.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              No activity yet.
            </p>
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
    usd === 0 ? "text-muted-foreground" : positive ? "text-green-600" : "";
  const lbpClass =
    lbp === 0 ? "text-muted-foreground" : positive ? "text-green-600" : "";
  return (
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className={`text-right font-mono ${usdClass}`}>
        {usd >= 0 ? "" : ""}
        {formatCurrency(usd, "USD")}
      </TableCell>
      <TableCell className={`text-right font-mono ${lbpClass}`}>
        {formatCurrency(lbp, "LBP")}
      </TableCell>
    </TableRow>
  );
}
