# Cash detach, shift guard, invite revoke, rate gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow revoking invitations, gate sales on exchange rate, detach Cash page from shifts (store-level drawer), and block opening shifts when the feature is disabled.

**Architecture:** Schema-light: only one optional-field relaxation (`shiftCashEvents.shiftId`). New helper `computeStoreDrawer`. New Convex queries `getStoreDrawer` and `listStoreCashEvents`. New mutation `invitations.remove`. UI gates added without behavior change to sales/returns. Existing permission keys reused.

**Tech Stack:** Convex (mutations/queries), Next.js 16 App Router, shadcn/ui v4 (@base-ui/react), Clerk auth.

**Note on TDD:** This project has no test framework configured (`apps/web/package.json` has no test script). Verification per task is `npx next build` from `apps/web/` plus manual click-through. Steps reflect that.

---

## File Map

**Create**
- (none)

**Modify**
- `apps/web/convex/schema.ts` — relax `shiftCashEvents.shiftId`
- `apps/web/convex/_helpers/shifts.ts` — add `computeStoreDrawer`
- `apps/web/convex/shifts.ts` — guard `open` on `shiftsEnabled`; rework `recordManualCash`; add `getStoreDrawer`, `listStoreCashEvents`
- `apps/web/convex/invitations.ts` — `remove` mutation
- `apps/web/app/actions/stores.ts` — `revokeInvitation`
- `apps/web/app/actions/shifts.ts` — `recordCash` signature change (storeId, not shiftId)
- `apps/web/app/(dashboard)/store/[storeId]/members/page.tsx` — revoke button in pending invites
- `apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx` — rate gate
- `apps/web/app/(dashboard)/store/[storeId]/page.tsx` — rate banner on store overview
- `apps/web/app/(dashboard)/store/[storeId]/cash/page.tsx` — store-drawer rework, remove `shiftsEnabled` gate
- `apps/web/app/(dashboard)/store/[storeId]/shifts/page.tsx` — disabled-feature gate
- `apps/web/app/(dashboard)/store/[storeId]/shifts/new/page.tsx` — disabled-feature gate
- `apps/web/components/layout/sidebar.tsx` — filter `shifts` nav link when `shiftsEnabled=false`

---

## Task 1: Allow optional shiftId on shiftCashEvents

**Files:**
- Modify: `apps/web/convex/schema.ts:338-362`

- [ ] **Step 1: Relax shiftId to optional**

In the `shiftCashEvents` table definition, change:

```ts
shiftCashEvents: defineTable({
  storeId: v.id("stores"),
  shiftId: v.id("shifts"),
```

to:

```ts
shiftCashEvents: defineTable({
  storeId: v.id("stores"),
  shiftId: v.optional(v.id("shifts")),
```

Leave indexes untouched — `by_shift` still works on optional fields (rows with missing values are simply not indexed under it).

- [ ] **Step 2: Verify schema compiles**

From `apps/web/`:

```
npx convex dev --once
```

Expected: no schema errors. (If `convex dev` isn't running, `npx next build` will also catch type errors via the generated stubs.)

- [ ] **Step 3: Commit**

```
git add apps/web/convex/schema.ts
git commit -m "schema: relax shiftCashEvents.shiftId to optional"
```

---

## Task 2: Add computeStoreDrawer helper

**Files:**
- Modify: `apps/web/convex/_helpers/shifts.ts`

- [ ] **Step 1: Add helper after `recordCashEvent`**

Append below the existing `recordCashEvent` function:

```ts
export type StoreDrawer = { drawerUSD: number; drawerLBP: number };

/**
 * Running store-level drawer balance = sum of all cash events for the store.
 * Opening shift counts are intentionally NOT included: that cash already
 * existed in the drawer before the shift opened.
 */
export async function computeStoreDrawer(
  db: DatabaseReader,
  storeId: Id<"stores">
): Promise<StoreDrawer> {
  const events = await db
    .query("shiftCashEvents")
    .withIndex("by_store_and_date", (q) => q.eq("storeId", storeId))
    .collect();
  let drawerUSD = 0;
  let drawerLBP = 0;
  for (const e of events) {
    drawerUSD += e.amountUSD;
    drawerLBP += e.amountLBP;
  }
  return { drawerUSD, drawerLBP };
}
```

- [ ] **Step 2: Commit**

```
git add apps/web/convex/_helpers/shifts.ts
git commit -m "feat(cash): add computeStoreDrawer helper"
```

---

## Task 3: Block opening shifts when feature disabled

**Files:**
- Modify: `apps/web/convex/shifts.ts:46-128` (the `open` mutation handler)

- [ ] **Step 1: Add feature gate at top of `open.handler`**

Right after `assertPageFunction(...)` and before the `openingUSD < 0` check, insert:

```ts
    const storeRow = await ctx.db.get(args.storeId);
    if (!storeRow?.shiftsEnabled) {
      throw new ConvexError({
        code: "FEATURE_DISABLED",
        message: "Shifts are disabled for this store. Enable them in settings first.",
      });
    }
```

- [ ] **Step 2: Build check**

From `apps/web/`:

```
npx next build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```
git add apps/web/convex/shifts.ts
git commit -m "fix(shifts): block opening when feature disabled"
```

---

## Task 4: Detach manual cash from shift (rework recordManualCash)

**Files:**
- Modify: `apps/web/convex/shifts.ts:304-401` (the `recordManualCash` mutation)

- [ ] **Step 1: Replace the mutation**

Replace the entire existing `export const recordManualCash = mutation({ ... })` block with:

```ts
export const recordManualCash = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    direction: v.union(v.literal("in"), v.literal("out")),
    amountUSD: v.float64(),
    amountLBP: v.float64(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "cash",
      args.direction === "in" ? "record_in" : "record_out"
    );

    const reason = args.reason.trim();
    if (!reason) {
      throw new ConvexError({
        code: "INVALID",
        message: "A reason is required for cash in/out.",
      });
    }
    if (args.amountUSD < 0 || args.amountLBP < 0) {
      throw new ConvexError({
        code: "INVALID",
        message: "Amounts must be zero or positive.",
      });
    }
    if (args.amountUSD === 0 && args.amountLBP === 0) {
      throw new ConvexError({
        code: "INVALID",
        message: "Enter an amount in USD or LBP.",
      });
    }

    // Cash-out can't exceed the store-level drawer balance.
    if (args.direction === "out") {
      const { drawerUSD, drawerLBP } = await computeStoreDrawer(
        ctx.db,
        args.storeId
      );
      if (
        args.amountUSD - drawerUSD > 1e-6 ||
        args.amountLBP - drawerLBP > 0.5
      ) {
        throw new ConvexError({
          code: "INSUFFICIENT_DRAWER",
          message: `Drawer has only ${drawerUSD.toFixed(2)} USD / ${Math.round(drawerLBP)} LBP. Record cash in first or reduce the amount.`,
        });
      }
    }

    // Tag to active shift if one exists; otherwise the event stands alone.
    const activeShift = await getActiveShiftFor(
      ctx.db,
      args.userId,
      args.storeId
    );

    const sign = args.direction === "in" ? 1 : -1;
    const eventId = await recordCashEvent(ctx.db, {
      storeId: args.storeId,
      shiftId: activeShift?._id,
      type: args.direction === "in" ? "manual_in" : "manual_out",
      amountUSD: sign * args.amountUSD,
      amountLBP: sign * args.amountLBP,
      reason,
      performedBy: args.userId,
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: args.direction === "in" ? "cash.in" : "cash.out",
      entityType: "cash",
      entityId: eventId,
      details: {
        amountUSD: args.amountUSD,
        amountLBP: args.amountLBP,
        reason,
        shiftId: activeShift?._id ?? null,
      },
    });

    return { eventId };
  },
});
```

- [ ] **Step 2: Update imports at top of file**

The existing imports include `computeShiftTotals, getActiveShiftFor, recordCashEvent`. Add `computeStoreDrawer`:

```ts
import {
  computeShiftTotals,
  computeStoreDrawer,
  getActiveShiftFor,
  recordCashEvent,
} from "./_helpers/shifts";
```

- [ ] **Step 3: Update recordCashEvent input type if needed**

Open `apps/web/convex/_helpers/shifts.ts`. In the `CashEventInput` type, change:

```ts
type CashEventInput = {
  storeId: Id<"stores">;
  shiftId: Id<"shifts">;
```

to:

```ts
type CashEventInput = {
  storeId: Id<"stores">;
  shiftId?: Id<"shifts">;
```

- [ ] **Step 4: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```
git add apps/web/convex/shifts.ts apps/web/convex/_helpers/shifts.ts
git commit -m "feat(cash): detach manual cash from shift; balance vs store drawer"
```

---

## Task 5: Add getStoreDrawer + listStoreCashEvents queries

**Files:**
- Modify: `apps/web/convex/shifts.ts` (append at end)

- [ ] **Step 1: Add queries at end of file**

Append after the existing `get` query:

```ts
export const getStoreDrawer = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "cash",
      "view_list"
    );
    return computeStoreDrawer(ctx.db, args.storeId);
  },
});

export const listStoreCashEvents = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    limit: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "cash",
      "view_list"
    );
    const take = Math.min(Math.max(args.limit ?? 50, 1), 200);
    const events = await ctx.db
      .query("shiftCashEvents")
      .withIndex("by_store_and_date", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(take);

    const filtered = events.filter(
      (e: Doc<"shiftCashEvents">) =>
        e.type === "manual_in" || e.type === "manual_out"
    );

    const userCache: Record<Id<"users">, string> = {} as Record<
      Id<"users">,
      string
    >;
    return Promise.all(
      filtered.map(async (e: Doc<"shiftCashEvents">) => {
        if (!userCache[e.performedBy]) {
          const u = await ctx.db.get(e.performedBy);
          userCache[e.performedBy] = u?.name ?? "Unknown";
        }
        return { ...e, performedByName: userCache[e.performedBy] };
      })
    );
  },
});
```

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```
git add apps/web/convex/shifts.ts
git commit -m "feat(cash): getStoreDrawer + listStoreCashEvents queries"
```

---

## Task 6: Update recordCash server action

**Files:**
- Modify: `apps/web/app/actions/shifts.ts:108-132`

- [ ] **Step 1: Replace `recordCash`**

Replace the existing `recordCash` function with:

```ts
export async function recordCash(
  storeId: string,
  direction: "in" | "out",
  amountUSD: number,
  amountLBP: number,
  reason: string
) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.shifts.recordManualCash, {
      storeId: storeId as Id<"stores">,
      userId,
      direction,
      amountUSD,
      amountLBP,
      reason,
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: extractErrorMessage(error, "Failed to record cash event"),
    };
  }
}
```

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: build will fail on `cash/page.tsx` (still passing `activeShift._id` to `recordCash`). That's fine — Task 7 fixes it.

- [ ] **Step 3: Commit**

```
git add apps/web/app/actions/shifts.ts
git commit -m "refactor(actions): recordCash takes storeId not shiftId"
```

---

## Task 7: Rework Cash page (store drawer, no shift gate)

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/cash/page.tsx`

- [ ] **Step 1: Replace the file body**

Replace the entire current file content with:

```tsx
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

      {/* Store drawer */}
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

      {/* Active shift sub-total */}
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

      {/* Record form — always available with permission */}
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

      {/* History */}
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
```

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Manual test (Cash page works without shift)**

Run `npm run dev` from repo root. As the store owner with `shiftsEnabled=false`:
1. Visit `/store/<id>/cash` — page should render (no longer shows "feature disabled" card).
2. Record a "Paid in" with USD=10, reason="test" → toast success, drawer balance shows 10 USD.
3. Record a "Paid out" with USD=5, reason="test out" → drawer shows 5 USD.
4. Record "Paid out" USD=999 → toast error "Drawer has only 5.00 USD...".

- [ ] **Step 4: Commit**

```
git add apps/web/app/(dashboard)/store/[storeId]/cash/page.tsx
git commit -m "feat(cash): store-level drawer page, works without shift"
```

---

## Task 8: Add invitations.remove mutation

**Files:**
- Modify: `apps/web/convex/invitations.ts` (append at end)

- [ ] **Step 1: Append `remove`**

Add at end of file:

```ts
export const remove = mutation({
  args: { inviteId: v.id("storeInvitations"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Invitation not found.",
      });
    }
    await assertPageFunction(
      ctx.db,
      args.userId,
      invite.storeId,
      "members",
      "invite_member"
    );
    await ctx.db.delete(args.inviteId);
    await createAuditLog(ctx.db, {
      storeId: invite.storeId,
      userId: args.userId,
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: args.inviteId,
      details: { email: invite.email, role: invite.role },
    });
    return { success: true };
  },
});
```

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```
git add apps/web/convex/invitations.ts
git commit -m "feat(invitations): hard-delete remove mutation"
```

---

## Task 9: revokeInvitation server action

**Files:**
- Modify: `apps/web/app/actions/stores.ts`

- [ ] **Step 1: Locate the existing pattern**

Open `apps/web/app/actions/stores.ts`. Find an existing exported async action (e.g. `inviteMember`). Copy its `requireCurrentUserId` + `convex.mutation` + try/catch pattern.

- [ ] **Step 2: Append `revokeInvitation`**

Append:

```ts
export async function revokeInvitation(storeId: string, inviteId: string) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.invitations.remove, {
      inviteId: inviteId as Id<"storeInvitations">,
      userId,
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: extractErrorMessage(error, "Failed to revoke invitation"),
    };
  }
}
```

If `extractErrorMessage` isn't already in scope, mirror the helper defined in `apps/web/app/actions/shifts.ts:12-19` — `ConvexError` → `error.data.message`, else `error.message`, else fallback.

If `Id` isn't imported, add `import { Id } from "@/convex/_generated/dataModel";` to the top.

- [ ] **Step 3: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```
git add apps/web/app/actions/stores.ts
git commit -m "feat(actions): revokeInvitation"
```

---

## Task 10: Wire revoke button into Members page

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/members/page.tsx`

- [ ] **Step 1: Import revokeInvitation and Trash icon**

In the imports block at the top:

```tsx
import { Trash2, UserPlus, MoreHorizontal, Copy } from "lucide-react";
import {
  inviteMember,
  updateMemberRole,
  removeMember,
  revokeInvitation,
} from "@/app/actions/stores";
```

- [ ] **Step 2: Add handler near `copyInviteLink`**

Inside `MembersPage`, alongside `copyInviteLink`:

```tsx
  async function handleRevoke(inviteId: string) {
    const result = await revokeInvitation(storeId, inviteId);
    if (result.success) {
      toast.success("Invitation revoked");
    } else {
      toast.error(result.error ?? "Failed to revoke");
    }
  }
```

- [ ] **Step 3: Add a trash button to the pending invites table**

In the pending-invitations `<Table>`, update the header to:

```tsx
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-32 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
```

And replace the row's last `<TableCell>` (currently just the Copy button) with:

```tsx
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyInviteLink(invite.token)}
                            title="Copy invite link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md h-8 px-2 text-destructive hover:bg-muted">
                              <Trash2 className="h-3.5 w-3.5" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {invite.email} will no longer be able to use this invitation link.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRevoke(invite._id)}>
                                  Revoke
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
```

- [ ] **Step 4: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 5: Manual test**

`npm run dev`. As owner:
1. Members page → Invite a colleague@example.com as Employee.
2. Pending invitation row appears.
3. Click Trash icon → AlertDialog → confirm → row disappears, toast "Invitation revoked".
4. Open `/invite/<that-token>` directly → "invitation is invalid or has expired".

- [ ] **Step 6: Commit**

```
git add apps/web/app/(dashboard)/store/[storeId]/members/page.tsx
git commit -m "feat(members): revoke pending invitation"
```

---

## Task 11: Block "New Sale" on sales list when no rate

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx`

- [ ] **Step 1: Add rate query and gate**

Open `apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx`. Near the other `useQuery` calls (e.g. for sales list), add:

```tsx
  const rate = useQuery(
    api.exchangeRates.getCurrent,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const canSetRate =
    isPrivileged ||
    (store?.effectivePermissions?.exchange_rate?.functions?.set_rate ?? false);
  const rateMissing = rate === null;
```

If `isPrivileged` / `store` aren't already in scope, add the same `useQuery(api.stores.getById, ...)` block used in other pages (see `cash/page.tsx:51-56` for the pattern). Reuse existing variables if present.

- [ ] **Step 2: Disable the "New Sale" button**

Find the existing `<Link href={.../sales/new}>` wrapping a `<Button>...</Button>` for creating a new sale. Replace with:

```tsx
        {rateMissing ? (
          <Button size="sm" disabled title="Set the exchange rate first">
            <Plus className="h-4 w-4 mr-1.5" />
            New Sale
          </Button>
        ) : (
          <Link href={`/store/${storeId}/sales/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1.5" />
              New Sale
            </Button>
          </Link>
        )}
```

(Match the existing icon/label — adjust if the current button uses different copy.)

- [ ] **Step 3: Add an inline banner**

Just below the page header, render:

```tsx
      {rateMissing && (
        <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="py-4 text-sm flex items-center justify-between gap-4">
            <p>
              No exchange rate set. Sales are blocked until an owner or admin sets one.
            </p>
            {canSetRate && (
              <Link href={`/store/${storeId}/exchange-rate`}>
                <Button variant="outline" size="sm">
                  Set exchange rate
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
```

Import `Card`, `CardContent` from `@/components/ui/card` if not already imported.

- [ ] **Step 4: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 5: Manual test**

`npm run dev`. In a fresh store with no rate set:
1. `/store/<id>/sales` → banner visible, "New Sale" button disabled.
2. Set rate at `/store/<id>/exchange-rate`.
3. Return to `/sales` → banner gone, button enabled.

- [ ] **Step 6: Commit**

```
git add apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx
git commit -m "feat(sales): gate New Sale button on exchange rate set"
```

---

## Task 12: Rate banner on store overview

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/page.tsx`

- [ ] **Step 1: Add same rate query + banner**

Open the store overview page. Add at the top of the component (after existing `useCurrentUser` / `useQuery` calls):

```tsx
  const rate = useQuery(
    api.exchangeRates.getCurrent,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const canSetRate =
    isPrivileged ||
    (store?.effectivePermissions?.exchange_rate?.functions?.set_rate ?? false);
```

(Reuse existing `store`/`isPrivileged` if already defined; otherwise add the same `useQuery(api.stores.getById, ...)` pattern.)

Render the banner near the top of the JSX, before the stat grid:

```tsx
      {rate === null && (
        <Card className="border-amber-500/40 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="py-4 text-sm flex items-center justify-between gap-4">
            <p>
              No exchange rate set yet. Sales will be blocked until one is configured.
            </p>
            {canSetRate && (
              <Link href={`/store/${storeId}/exchange-rate`}>
                <Button variant="outline" size="sm">
                  Set exchange rate
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
```

Make sure `Link`, `Button`, `Card`, `CardContent` are imported.

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```
git add apps/web/app/(dashboard)/store/[storeId]/page.tsx
git commit -m "feat(overview): banner when exchange rate not set"
```

---

## Task 13: Gate Shifts list page on shiftsEnabled

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/shifts/page.tsx`

- [ ] **Step 1: Add disabled-feature branch**

Inside `ShiftsListPage`, after the existing `store` query is set up, add — before the existing `return (...)`:

```tsx
  if (store && !store.shiftsEnabled) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <h1 className="text-2xl font-bold">Shifts</h1>
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
```

`Card`, `CardContent`, `Link`, `Button` are already imported in this file.

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```
git add apps/web/app/(dashboard)/store/[storeId]/shifts/page.tsx
git commit -m "feat(shifts): disabled-feature gate on list page"
```

---

## Task 14: Gate Open-shift page on shiftsEnabled

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/shifts/new/page.tsx`

- [ ] **Step 1: Add store query + gate**

At the top of `OpenShiftPage` (after `useCurrentUser`), add:

```tsx
  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
```

Before the existing `return (...)`, add:

```tsx
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
```

`Card`/`CardContent`/`Link`/`Button` are already imported in this file.

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Manual test (the fix)**

`npm run dev`. As owner with `shiftsEnabled=false`:
1. Visit `/store/<id>/shifts` → "Shifts feature is disabled" card.
2. Visit `/store/<id>/shifts/new` directly → same card, NO form.
3. (Optional API-level check) Open browser devtools, try to call `convex.mutation(api.shifts.open, ...)` → ConvexError with `FEATURE_DISABLED`.

- [ ] **Step 4: Commit**

```
git add apps/web/app/(dashboard)/store/[storeId]/shifts/new/page.tsx
git commit -m "feat(shifts): disabled-feature gate on open page"
```

---

## Task 15: Hide Shifts nav link when feature disabled

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx:46-64`

- [ ] **Step 1: Filter `shifts` page key based on `shiftsEnabled`**

In the `pageLinks` filter step, augment the predicate. Find:

```tsx
  const pageLinks = PAGE_KEYS
    .filter(
      (page) =>
        PAGE_META[page] !== undefined &&
        (isPrivileged || (permissions?.[page]?.enabled ?? false))
    )
```

Replace with:

```tsx
  const shiftsEnabled = liveStore?.shiftsEnabled ?? false;
  const pageLinks = PAGE_KEYS
    .filter(
      (page) =>
        PAGE_META[page] !== undefined &&
        (page !== "shifts" || shiftsEnabled) &&
        (isPrivileged || (permissions?.[page]?.enabled ?? false))
    )
```

Cash stays visible regardless — per the new design, Cash works without shifts.

- [ ] **Step 2: Build check**

```
cd apps/web && npx next build
```

Expected: clean build.

- [ ] **Step 3: Manual test**

`npm run dev`. With `shiftsEnabled=false`: sidebar should NOT show "Shifts" link; Cash IS shown.
Toggle the setting on → sidebar shows Shifts.

- [ ] **Step 4: Commit**

```
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(sidebar): hide Shifts when feature disabled"
```

---

## Task 16: Final end-to-end pass

- [ ] **Step 1: Full build from repo root**

```
npm run build
```

Expected: turbo runs `next build` and any other workspace builds cleanly.

- [ ] **Step 2: Smoke checklist (one happy path through all four asks)**

`npm run dev`. As owner of a fresh store with `shiftsEnabled=false` and NO exchange rate set:

1. **Rate gate:** `/store/<id>` overview → amber banner visible. `/sales` → "New Sale" disabled.
2. Set rate at `/exchange-rate` → both banners gone.
3. **Shifts disabled fix:** sidebar has no "Shifts" link. Visiting `/shifts` or `/shifts/new` directly → "feature disabled" card.
4. **Cash without shift:** `/cash` works. Record paid-in $10 → store drawer goes 0 → 10. Record paid-out $5 → drawer 5.
5. Toggle `shiftsEnabled=true` in settings → sidebar gains "Shifts". Open a shift with $0 opening.
6. **Cash with shift:** `/cash` now shows "Active shift sub-total" card below the store drawer. Record paid-in $7 → store drawer 12, shift sub-total 7. History row shows `shift` link.
7. **Invite revoke:** `/members` → invite a colleague. Pending row appears. Click trash → confirm → row gone. Visit `/invite/<token>` → "invalid or expired".

- [ ] **Step 3: Final commit if any leftover changes**

```
git status
```

If clean, you're done. Otherwise stage and commit.

---

## Notes for the implementer

- The Convex auto-generated stub files (`apps/web/convex/_generated/api.d.ts` etc.) will lag the new mutations/queries until `npx convex dev` is running. `npx next build` is robust to this in this project (see CLAUDE.md gotcha). If you see "Property 'remove' does not exist on type" or similar, that's the stub — run `npx convex dev --once` from `apps/web/` once after Task 8 and Task 5 to refresh them, OR keep `npx convex dev` running in another terminal throughout.
- The schema relaxation in Task 1 is backwards-compatible: existing rows with required `shiftId` validate fine against the optional type.
- Audit logs use `action: "cash.in" / "cash.out" / "invitation.revoke"` — new keys, no breaking change to existing log consumers.
- All ConvexError throws use the existing `{ code, message }` shape so the `extractErrorMessage` server-action helper surfaces friendly toasts unchanged.
- No new permission keys are introduced; existing `cash.record_in/record_out/view_list`, `members.invite_member`, `exchange_rate.set_rate` are reused.
