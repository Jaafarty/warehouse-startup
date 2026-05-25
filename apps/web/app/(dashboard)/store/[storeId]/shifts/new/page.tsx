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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

  const registers = useQuery(
    api.registers.listActive,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const hasRegisters = (registers?.length ?? 0) > 0;

  const [registerId, setRegisterId] = useState("");
  const [carryOver, setCarryOver] = useState(false);
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [pending, setPending] = useState(false);

  // Carry-over follows the last close on the SELECTED register (or, for a
  // store with no registers, the store's last close). Don't query until we
  // know which.
  const carrySource = useQuery(
    api.shifts.getCarryOverSource,
    userId && registers !== undefined && (!hasRegisters || registerId)
      ? {
          storeId: storeId as Id<"stores">,
          userId,
          registerId: registerId ? (registerId as Id<"registers">) : undefined,
        }
      : "skip"
  );

  const carriedUSD = carrySource?.countedUSD ?? 0;
  const carriedLBP = carrySource?.countedLBP ?? 0;
  const canCarry =
    carrySource?.countedUSD != null && carrySource?.countedLBP != null;

  const selected = registers?.find((r) => r._id === registerId);

  async function handleSubmit(formData: FormData) {
    if (hasRegisters && !registerId) {
      toast.error("Select a register to open a shift on.");
      return;
    }
    if (selected?.inUse) {
      toast.error("That register is already in use. Pick another.");
      return;
    }
    if (registerId) formData.set("registerId", registerId);
    if (carryOver && canCarry) {
      formData.set("openingUSD", String(carriedUSD));
      formData.set("openingLBP", String(carriedLBP));
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

  const registerLabel = (id: string) =>
    registers?.find((r) => r._id === id)?.name ?? "Select a register";

  const carryDisabled = carryOver && canCarry;

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
            {hasRegisters && (
              <div className="space-y-1.5">
                <Label htmlFor="register-select">Register</Label>
                <Select
                  value={registerId}
                  onValueChange={(v) => {
                    setRegisterId(v ?? "");
                    setCarryOver(false);
                  }}
                >
                  <SelectTrigger id="register-select">
                    <SelectValue placeholder="Select a register">
                      {(value: string) => registerLabel(value)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {registers?.map((r) => (
                      <SelectItem
                        key={r._id}
                        value={r._id}
                        label={r.name}
                        disabled={r.inUse}
                      >
                        <span className="flex items-center justify-between gap-3 w-full">
                          <span>{r.name}</span>
                          {r.inUse && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
                              In use{r.heldByName ? ` · ${r.heldByName}` : ""}
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A register in use has an open shift and can&apos;t be
                  selected until it&apos;s closed.
                </p>
              </div>
            )}

            {(!hasRegisters || registerId) && canCarry && (
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
                    Carry over from last closed shift
                    {hasRegisters ? " on this register" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(carriedUSD, "USD")} ·{" "}
                    {formatCurrency(carriedLBP, "LBP")}
                    {carrySource?.closedByName
                      ? ` · closed by ${carrySource.closedByName}`
                      : ""}
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
                  value={carryDisabled ? carriedUSD.toFixed(2) : usd}
                  onChange={(e) => setUsd(e.target.value)}
                  disabled={carryDisabled}
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
                  value={carryDisabled ? String(carriedLBP) : lbp}
                  onChange={(e) => setLbp(e.target.value)}
                  disabled={carryDisabled}
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
          <Button type="submit" disabled={pending || selected?.inUse}>
            {pending ? "Opening..." : "Open shift"}
          </Button>
        </div>
      </form>
    </div>
  );
}
