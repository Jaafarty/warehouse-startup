# Cash detach, shift guard, invite revoke, rate gate

**Date:** 2026-05-12

## Scope

Four targeted changes touching members, shifts, cash, and sales/exchange-rate UX. All small, none requiring data migration beyond one schema field relaxation.

## 1. Remove pending invitations

### Backend

`apps/web/convex/invitations.ts` — add:

```ts
export const remove = mutation({
  args: { inviteId: v.id("storeInvitations"), userId: v.id("users") },
  handler: async (ctx, { inviteId, userId }) => {
    const invite = await ctx.db.get(inviteId);
    if (!invite) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invitation not found." });
    }
    await assertPageFunction(ctx.db, userId, invite.storeId, "members", "invite_member");
    await ctx.db.delete(inviteId);
    await createAuditLog(ctx.db, {
      storeId: invite.storeId,
      userId,
      action: "invitation.revoke",
      entityType: "invitation",
      entityId: inviteId,
      details: { email: invite.email, role: invite.role },
    });
    return { success: true };
  },
});
```

Hard delete (per user choice). Audit log preserves trail.

### Server action

`apps/web/app/actions/stores.ts` — add `revokeInvitation(storeId, inviteId)` mirroring existing pattern (`requireCurrentUserId` → `api.invitations.remove` → `extractErrorMessage`).

### UI

`apps/web/app/(dashboard)/store/[storeId]/members/page.tsx` — in the Pending Invitations table, add a trash button alongside the existing Copy button. Wrap in `AlertDialog` confirming "Revoke invitation for {email}?". Disable while pending. Toast on result.

## 2. Block sales when no exchange rate set

### UI gates

`apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx`:
- Query `api.exchangeRates.getCurrent`.
- If `null`: disable "New Sale" button with tooltip "Set exchange rate first"; render an inline `Card` banner with link to `/store/[storeId]/exchange-rate` (only for users with `exchange_rate.set_rate` permission, else generic "ask owner/admin").

`apps/web/app/(dashboard)/store/[storeId]/page.tsx` (store overview):
- Same banner shown above quick stats for privileged users.

### Backend

No change. `convex/sales.ts:165-167` already throws `"Exchange rate must be set before creating sales"`. UI gating just prevents users hitting it.

## 3. Cash detached from shifts (store-level drawer)

### Schema

`apps/web/convex/schema.ts` — relax `shiftCashEvents.shiftId`:

```ts
shiftCashEvents: defineTable({
  storeId: v.id("stores"),
  shiftId: v.optional(v.id("shifts")),  // was v.id("shifts")
  ...
})
  .index("by_shift", ["shiftId"])  // still valid; existing rows untouched
  .index("by_store_and_date", ["storeId", "createdAt"])
```

No data migration needed; existing rows keep their `shiftId`.

### Helper

`apps/web/convex/_helpers/shifts.ts` — add:

```ts
export type StoreDrawer = { drawerUSD: number; drawerLBP: number };

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

Opening shift counts remain a snapshot on the `shifts` row — they do NOT feed store drawer, since opening cash already exists in the drawer prior to the shift.

### Mutation rework

`apps/web/convex/shifts.ts` — replace `recordManualCash`:

- Accept `storeId` (always required). `shiftId` becomes optional argument; ignored — we look up the caller's active shift and tag the event only if one exists.
- Drop "shift must be open" / "openedBy must match user" guards.
- Permission check: `assertPageFunction(db, userId, storeId, "cash", direction === "in" ? "record_in" : "record_out")`.
- Cash-out balance guard: compare against `computeStoreDrawer(storeId)` rather than shift totals.
- Insert event with `shiftId: activeShift?._id`.

Audit log keys off `storeId` not `shiftId`.

### Server action

`apps/web/app/actions/shifts.ts:recordCash` — change signature from `(shiftId, direction, …)` to `(storeId, direction, …)`. Drop the shiftId argument entirely.

### Cash page

`apps/web/app/(dashboard)/store/[storeId]/cash/page.tsx`:
- Remove the `!store?.shiftsEnabled` early-return block. Page works regardless.
- Add new query `api.shifts.getStoreDrawer` (new public query wrapping `computeStoreDrawer` with `view_list` permission check).
- Top card: "Store drawer balance" — uses `storeDrawer.drawerUSD/LBP`.
- If `activeShift` exists: render a smaller secondary card "Active shift sub-total" with shift drawer from `shiftDetail.totals` and "View shift" link.
- Manual cash form: render whenever user has at least one of `record_in`/`record_out`, regardless of shift presence.
- History table: list events for the store (new query `api.shifts.listStoreCashEvents` — recent N manual_in/manual_out for the store, enriched with cashier name and shift number/link if attached).

### Sales / returns unchanged

`requireActiveShiftIfEnabled` and the shift-tagging in `sales.create` / `returns.create` stay as-is. Only the **cash page UX** detaches; sales still require an active shift when the feature is enabled.

## 4. Fix: opening shift while feature disabled

### Backend guard

`apps/web/convex/shifts.ts:open` — add at top of handler:

```ts
const store = await ctx.db.get(args.storeId);
if (!store?.shiftsEnabled) {
  throw new ConvexError({
    code: "FEATURE_DISABLED",
    message: "Shifts are disabled for this store. Enable in settings first.",
  });
}
```

### UI gates

`apps/web/app/(dashboard)/store/[storeId]/shifts/page.tsx`:
- If `store && !store.shiftsEnabled`: render a single card "Shifts feature is disabled. Enable it in Store Settings." with link to settings (privileged only). Hide Open/Tabs.

`apps/web/app/(dashboard)/store/[storeId]/shifts/new/page.tsx`:
- Same check; redirect to `/store/[id]/shifts` or render disabled card.

`components/layout/sidebar.tsx` — verify Shifts nav item already hides when `!store.shiftsEnabled`; if not, add the gate.

## Files touched

- `apps/web/convex/schema.ts` — relax `shiftCashEvents.shiftId`.
- `apps/web/convex/invitations.ts` — `remove` mutation.
- `apps/web/convex/shifts.ts` — guard in `open`, rework `recordManualCash`, add `getStoreDrawer` + `listStoreCashEvents` queries.
- `apps/web/convex/_helpers/shifts.ts` — `computeStoreDrawer` helper.
- `apps/web/app/actions/stores.ts` — `revokeInvitation`.
- `apps/web/app/actions/shifts.ts` — `recordCash` signature change.
- `apps/web/app/(dashboard)/store/[storeId]/members/page.tsx` — revoke button.
- `apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx` — rate gate.
- `apps/web/app/(dashboard)/store/[storeId]/page.tsx` — rate banner.
- `apps/web/app/(dashboard)/store/[storeId]/cash/page.tsx` — store-drawer rework.
- `apps/web/app/(dashboard)/store/[storeId]/shifts/page.tsx` — disabled gate.
- `apps/web/app/(dashboard)/store/[storeId]/shifts/new/page.tsx` — disabled gate.
- `apps/web/components/layout/sidebar.tsx` — verify shifts gate.

## Testing

Build verification: `npx next build` from `apps/web` after changes.

Manual:
1. Revoke pending invite → row disappears, token `/invite/<token>` returns "invalid".
2. Unset rate (or fresh store) → "New Sale" disabled with tooltip; banner shows.
3. With shifts feature off and no shift open: cash-in $10 → store drawer goes from 0 to 10; event shown with no shift link.
4. With shifts feature on and active shift: cash-in $5 → store drawer +5 AND shift sub-total +5.
5. Try open shift while `shiftsEnabled=false` (via direct URL `/shifts/new`) → backend throws, UI shows disabled card.

## Non-goals

- No migration of legacy `editor` role.
- No change to sales/returns shift behavior.
- No change to refund-cash-out flow.
- No new permission keys.
