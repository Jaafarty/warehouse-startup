"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { createReturn } from "@/app/actions/returns";
import { formatCurrency } from "@ware-house/shared";
import { ArrowLeft } from "lucide-react";
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
    userId ? { saleId: saleId as any, userId: userId as any } : "skip"
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<Reason>("defective");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const refundTotal = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((sum: number, item: any) => {
      if (!selected[item._id]) return sum;
      const remaining = item.quantity - item.returnedQuantity;
      const qty = Math.min(qtys[item._id] ?? remaining, remaining);
      return sum + qty * item.unitPrice;
    }, 0);
  }, [sale, selected, qtys]);

  if (sale === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (sale === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Sale not found.</p>
      </div>
    );
  }

  function toggleLine(itemId: string, item: any) {
    setSelected((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      return next;
    });
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
        const it = sale!.items.find((i: any) => i._id === saleItemId);
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

    setPending(true);
    const result = await createReturn(
      saleId,
      items,
      reason,
      note.trim() || undefined
    );
    setPending(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to process return");
      return;
    }

    toast.success(`Return ${result.returnNumber} processed`);
    router.push(`/store/${storeId}/returns/${result.returnId}`);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/sales/${saleId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            Process return —{" "}
            <span className="font-mono">{sale.saleNumber}</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Tick items to return. Adjust quantities for partial returns.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items to return</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Already returned</TableHead>
                <TableHead className="text-right">Return qty</TableHead>
                <TableHead className="text-right">Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item: any) => {
                const remaining = item.quantity - item.returnedQuantity;
                const fullyReturned = remaining <= 0;
                const isSelected = !!selected[item._id];
                const qty = qtys[item._id] ?? remaining;
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
                            setQty(item._id, Number(e.target.value), remaining)
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
                      {refund > 0 ? formatCurrency(refund) : "—"}
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
          <Select
            value={reason}
            onValueChange={(v) => setReason((v ?? "defective") as Reason)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value} label={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <p className="text-sm text-muted-foreground">Refund total</p>
          <p className="text-2xl font-bold">{formatCurrency(refundTotal)}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/store/${storeId}/sales/${saleId}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={pending || refundTotal <= 0}>
            {pending ? "Processing..." : "Save return"}
          </Button>
        </div>
      </div>
    </div>
  );
}
