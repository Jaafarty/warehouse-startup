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
import { ArrowLeft, Clock } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Clock}
        title="Open shift"
        subtitle="Count the drawer before you start."
        right={
          <Link href={`/store/${storeId}/shifts`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to shifts
            </Button>
          </Link>
        }
      />

      <form action={handleSubmit}>
        <div className="grid gap-5 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-5 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Opening cash</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="openingUSD">Opening USD</Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base font-semibold text-muted-foreground">
                        $
                      </span>
                      <Input
                        id="openingUSD"
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        value={carryDisabled ? carriedUSD.toFixed(2) : usd}
                        onChange={(e) => setUsd(e.target.value)}
                        disabled={carryDisabled}
                        placeholder="0.00"
                        className="pl-7 font-mono"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="openingLBP">Opening LBP</Label>
                    <Input
                      id="openingLBP"
                      type="number"
                      step="1"
                      min="0"
                      inputMode="decimal"
                      value={carryDisabled ? String(carriedLBP) : lbp}
                      onChange={(e) => setLbp(e.target.value)}
                      disabled={carryDisabled}
                      placeholder="0"
                      className="font-mono"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3">
              <Link href={`/store/${storeId}/shifts`}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" disabled={pending || selected?.inUse}>
                {pending ? "Opening…" : "Open shift"}
              </Button>
            </div>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Before you open</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {hasRegisters ? (
                  <p>
                    Pick the register you&apos;re working. Each holds one open
                    shift at a time, so in-use registers are greyed out.
                  </p>
                ) : (
                  <p>
                    This store uses a single shared drawer. Count it before you
                    start your shift.
                  </p>
                )}
                <p>
                  Carry over to seed today&apos;s opening from the last closed
                  shift&apos;s counted total — otherwise enter the count
                  manually.
                </p>
                <p>
                  Sales and cash events you record will be tracked against this
                  shift until you close it.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </form>
    </div>
  );
}
