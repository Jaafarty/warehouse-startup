"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { createReturn } from "@/app/actions/returns";
import { formatCurrency } from "@ware-house/shared";
import { RotateCcw, Wallet, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";

type Reason =
  | "defective"
  | "wrong_item"
  | "damaged_in_transit"
  | "customer_changed_mind"
  | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "defective", label: "Defective" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "damaged_in_transit", label: "Damaged in transit" },
  { value: "customer_changed_mind", label: "Customer changed mind" },
  { value: "other", label: "Other" },
];

export default function ProcessReturnPage() {
  const { storeId, saleId } = useParams<{
    storeId: string;
    saleId: string;
  }>();
  const router = useRouter();
  const { userId } = useCurrentUser();

  const sale = useQuery(
    api.sales.get,
    userId ? { saleId: saleId as Id<"sales">, userId: userId } : "skip"
  );

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const activeShift = useQuery(
    api.shifts.getActive,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const shiftsBlocking = store?.shiftsEnabled === true && activeShift === null;
  const activeShiftDetail = useQuery(
    api.shifts.get,
    userId && activeShift
      ? { shiftId: activeShift._id, userId }
      : "skip"
  );
  const drawerUSD = activeShiftDetail?.totals.expectedClosingUSD ?? 0;
  const drawerLBP = activeShiftDetail?.totals.expectedClosingLBP ?? 0;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<Reason>("defective");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [refundUSDStr, setRefundUSDStr] = useState("");
  const [refundLBPStr, setRefundLBPStr] = useState("");

  const saleRate = sale?.exchangeRate ?? 1;

  const refundTotalUSD = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((sum: number, item) => {
      if (!selected[item._id]) return sum;
      const remaining = item.quantity - item.returnedQuantity;
      const qty = Math.min(qtys[item._id] ?? remaining, remaining);
      const itemUSD =
        item.unitPriceUSD ??
        ((item.currency ?? "USD") === "USD"
          ? item.unitPrice
          : item.unitPrice / saleRate);
      return sum + qty * itemUSD;
    }, 0);
  }, [sale, selected, qtys, saleRate]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const refundedUSD = Number(refundUSDStr) || 0;
  const refundedLBP = Number(refundLBPStr) || 0;
  const refundSplitProvided = refundUSDStr !== "" || refundLBPStr !== "";
  const cashierTotalUSD = refundedUSD + refundedLBP / saleRate;
  const splitMatches =
    !refundSplitProvided ||
    Math.abs(cashierTotalUSD - refundTotalUSD) <= 0.01;

  const effectiveRefundUSD = refundSplitProvided ? refundedUSD : refundTotalUSD;
  const effectiveRefundLBP = refundSplitProvided ? refundedLBP : 0;
  const willOverdrawUSD =
    !!activeShift && effectiveRefundUSD > drawerUSD + 1e-6;
  const willOverdrawLBP =
    !!activeShift && effectiveRefundLBP > drawerLBP + 0.5;
  const willOverdraw = willOverdrawUSD || willOverdrawLBP;

  if (sale === undefined) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
        <Skeleton className="h-20 w-full" />
        <div className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="lg:col-span-2 h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (sale === null) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }}>
        <p className="text-destructive">Sale not found.</p>
      </div>
    );
  }

  if (shiftsBlocking) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
        <PageHeader
          icon={RotateCcw}
          title="Process return"
          subtitle={`Sale ${sale.saleNumber}`}
        />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>No active shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Refunds reduce drawer cash. Open a shift before processing this
              return.
            </p>
            <Link href={`/store/${storeId}/shifts/new`}>
              <Button>Open shift</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  function toggleLine(
    itemId: string,
    item: { quantity: number; returnedQuantity: number }
  ) {
    setSelected((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
    setQtys((prev) => {
      if (prev[itemId] !== undefined) return prev;
      return { ...prev, [itemId]: item.quantity - item.returnedQuantity };
    });
  }

  function setQty(itemId: string, raw: number, max: number) {
    const clamped = Math.max(0, Math.min(Math.floor(raw), max));
    setQtys((prev) => ({ ...prev, [itemId]: clamped }));
  }

  async function handleSubmit() {
    const items = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([saleItemId]) => {
        const it = sale!.items.find((i) => i._id === saleItemId);
        const remaining = it ? it.quantity - it.returnedQuantity : 0;
        const qty = qtys[saleItemId] ?? remaining;
        return { saleItemId, quantity: Math.min(qty, remaining) };
      })
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (reason === "other" && !note.trim()) {
      toast.error("Note is required when reason is Other");
      return;
    }

    if (refundSplitProvided && !splitMatches) {
      toast.error(
        `Refund split does not match the eligible amount ($${refundTotalUSD.toFixed(2)} USD-eq.)`
      );
      return;
    }

    setPending(true);
    const result = await createReturn(
      saleId,
      items,
      reason,
      note.trim() || undefined,
      refundSplitProvided ? { refundedUSD, refundedLBP } : undefined
    );
    setPending(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to process return");
      return;
    }

    toast.success(`Return ${result.returnNumber} processed`);
    router.push(`/store/${storeId}/returns/${result.returnId}`);
  }

  function fillExactUSD() {
    setRefundUSDStr(refundTotalUSD.toFixed(2));
    setRefundLBPStr("0");
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={RotateCcw}
        title={
          <span>
            Process return —{" "}
            <span className="font-mono">{sale.saleNumber}</span>
          </span>
        }
        subtitle="Tick items to return. Adjust quantities for partial returns."
        right={
          <>
            <Link href={`/store/${storeId}/sales/${saleId}`}>
              <Button variant="outline">Cancel</Button>
            </Link>
            <Button
              onClick={handleSubmit}
              disabled={pending || refundTotalUSD <= 0}
            >
              {pending
                ? "Processing..."
                : `Save return · ${formatCurrency(refundTotalUSD, "USD")}`}
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Items to return</CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12" />
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">
                      Already returned
                    </TableHead>
                    <TableHead className="text-right">Return qty</TableHead>
                    <TableHead className="text-right">Refund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.items.map((item) => {
                    const remaining = item.quantity - item.returnedQuantity;
                    const fullyReturned = remaining <= 0;
                    const isSelected = !!selected[item._id];
                    const qty = qtys[item._id] ?? remaining;
                    const itemCurrency = (item.currency ?? "USD") as
                      | "USD"
                      | "LBP";
                    const refund = isSelected ? qty * item.unitPrice : 0;

                    return (
                      <TableRow
                        key={item._id}
                        className={fullyReturned ? "opacity-50" : ""}
                      >
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            disabled={fullyReturned}
                            onCheckedChange={() => toggleLine(item._id, item)}
                            aria-label={`Return ${item.productName}`}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {item.productName}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.quantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.returnedQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          {isSelected ? (
                            <Input
                              type="number"
                              min={1}
                              max={remaining}
                              value={qty}
                              onChange={(e) =>
                                setQty(
                                  item._id,
                                  Number(e.target.value),
                                  remaining
                                )
                              }
                              className="w-20 ml-auto"
                            />
                          ) : (
                            <span className="text-muted-foreground">
                              {fullyReturned ? "—" : remaining}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {refund > 0
                            ? formatCurrency(refund, itemCurrency)
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Reason</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Select
                    value={reason}
                    onValueChange={(v) =>
                      setReason((v ?? "defective") as Reason)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue>
                        {(v) =>
                          REASONS.find((r) => r.value === v)?.label ?? v
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {REASONS.map((r) => (
                        <SelectItem
                          key={r.value}
                          value={r.value}
                          label={r.label}
                        >
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Note{reason === "other" ? " (required)" : " (optional)"}
                </Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={
                    reason === "other"
                      ? "Describe the reason for the return"
                      : "Optional details"
                  }
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Refund summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Refund total</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(refundTotalUSD, "USD")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatCurrency(refundTotalUSD * saleRate, "LBP")}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Lines</p>
                  <p className="text-xl font-bold">{selectedCount}</p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Reason</p>
                  <p className="text-sm font-medium truncate">
                    {REASONS.find((r) => r.value === reason)?.label}
                  </p>
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  Locked rate:{" "}
                  <span className="font-medium text-foreground font-mono">
                    1 USD = {saleRate.toLocaleString()} LBP
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Refund split</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="refundUSD" className="text-xs">
                    USD
                  </Label>
                  <Input
                    id="refundUSD"
                    type="number"
                    step="0.01"
                    min="0"
                    value={refundUSDStr}
                    onChange={(e) => setRefundUSDStr(e.target.value)}
                    placeholder={refundTotalUSD.toFixed(2)}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="refundLBP" className="text-xs">
                    LBP
                  </Label>
                  <Input
                    id="refundLBP"
                    type="number"
                    step="1"
                    min="0"
                    value={refundLBPStr}
                    onChange={(e) => setRefundLBPStr(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={fillExactUSD}
                disabled={refundTotalUSD <= 0}
              >
                Fill exact USD
              </Button>
              {refundSplitProvided && !splitMatches && (
                <p className="text-xs text-destructive">
                  Split sums to {formatCurrency(cashierTotalUSD, "USD")} —
                  must equal eligible refund.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Leave blank to refund full eligible amount in USD.
              </p>
            </CardContent>
          </Card>

          {activeShift && (
            <Card className={willOverdraw ? "border-destructive/40" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Drawer balance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">USD</span>
                  <span className="font-medium font-mono">
                    {formatCurrency(drawerUSD, "USD")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">LBP</span>
                  <span className="font-medium font-mono">
                    {formatCurrency(drawerLBP, "LBP")}
                  </span>
                </div>
                {willOverdraw && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      This refund will push the drawer negative. Proceed only
                      if you intend to settle from outside the till.
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
