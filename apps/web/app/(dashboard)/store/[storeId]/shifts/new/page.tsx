"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { openShift } from "@/app/actions/shifts";
import { formatCurrency } from "@ware-house/shared";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function OpenShiftPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";

  const lastClosed = useQuery(
    api.shifts.getLastClosedForUser,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const [carryOver, setCarryOver] = useState(false);
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    if (carryOver) {
      // Backend ignores opening fields and uses last closed shift values, but
      // pass them anyway as a defensive default.
      formData.set("openingUSD", String(lastClosed?.countedUSD ?? 0));
      formData.set("openingLBP", String(lastClosed?.countedLBP ?? 0));
    } else {
      formData.set("openingUSD", usd || "0");
      formData.set("openingLBP", lbp || "0");
    }
    setPending(true);
    const result = await openShift(storeId, formData);
    setPending(false);
    if (result && !result.success) {
      toast.error(result.error ?? "Failed to open shift");
    }
  }

  const carriedUSD = lastClosed?.countedUSD ?? 0;
  const carriedLBP = lastClosed?.countedLBP ?? 0;

  if (store && !store.shiftsEnabled) {
    return (
      <div className="p-6 max-w-xl space-y-4">
        <h1 className="text-2xl font-bold">Open shift</h1>
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
    <div className="p-6 max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/shifts`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Open shift</h1>
          <p className="text-muted-foreground">
            Count the drawer before you start.
          </p>
        </div>
      </div>

      <form action={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opening cash</CardTitle>
            <CardDescription>
              Enter the cash you start with — both currencies tracked separately.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lastClosed && (
              <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/40">
                <input
                  name="carryOver"
                  type="checkbox"
                  checked={carryOver}
                  onChange={(e) => setCarryOver(e.target.checked)}
                  className="mt-1"
                />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    Carry over from my last closed shift
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(carriedUSD, "USD")} ·{" "}
                    {formatCurrency(carriedLBP, "LBP")}
                  </p>
                </div>
              </label>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="openingUSD">Opening USD</Label>
                <Input
                  id="openingUSD"
                  type="number"
                  step="0.01"
                  min="0"
                  value={carryOver ? carriedUSD.toFixed(2) : usd}
                  onChange={(e) => setUsd(e.target.value)}
                  disabled={carryOver}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="openingLBP">Opening LBP</Label>
                <Input
                  id="openingLBP"
                  type="number"
                  step="1"
                  min="0"
                  value={carryOver ? String(carriedLBP) : lbp}
                  onChange={(e) => setLbp(e.target.value)}
                  disabled={carryOver}
                  placeholder="0"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3 mt-4">
          <Link href={`/store/${storeId}/shifts`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Opening..." : "Open shift"}
          </Button>
        </div>
      </form>
    </div>
  );
}
