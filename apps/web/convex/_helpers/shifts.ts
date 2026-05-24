import { ConvexError } from "convex/values";
import { DatabaseReader, DatabaseWriter } from "../_generated/server";
import { Doc, Id } from "../_generated/dataModel";

/**
 * Returns the caller's currently-open shift in the store, or null.
 * Used by sales/returns guards and dashboard widgets.
 *
 * Defensive: if data ever ends up with multiple open shifts for a user
 * (e.g. a reopened shift while another was already open), returns the most
 * recently opened one instead of throwing — keeps the dashboard alive.
 */
export async function getActiveShiftFor(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">
): Promise<Doc<"shifts"> | null> {
  return db
    .query("shifts")
    .withIndex("by_store_user_status", (q) =>
      q.eq("storeId", storeId).eq("openedBy", userId).eq("status", "open")
    )
    .order("desc")
    .first();
}

/**
 * Throws when shifts are required (store-level toggle on) and the caller
 * has no open shift. Returns the active shift document, or null when the
 * feature is disabled for this store.
 */
export async function requireActiveShiftIfEnabled(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">
): Promise<Doc<"shifts"> | null> {
  const store = await db.get(storeId);
  if (!store?.shiftsEnabled) return null;
  const active = await getActiveShiftFor(db, userId, storeId);
  if (!active) {
    throw new ConvexError({
      code: "NO_ACTIVE_SHIFT",
      message: "Open a shift before recording this transaction.",
    });
  }
  return active;
}

type CashEventInput = {
  storeId: Id<"stores">;
  shiftId?: Id<"shifts">;
  type: Doc<"shiftCashEvents">["type"];
  amountUSD: number;
  amountLBP: number;
  reason?: string;
  referenceType?: "sale" | "sale_return";
  referenceId?: string;
  performedBy: Id<"users">;
};

export async function recordCashEvent(
  db: DatabaseWriter,
  params: CashEventInput
): Promise<Id<"shiftCashEvents">> {
  return db.insert("shiftCashEvents", {
    ...params,
    createdAt: Date.now(),
  });
}

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

export type ShiftTotals = {
  salesUSD: number;
  salesLBP: number;
  returnsUSD: number;
  returnsLBP: number;
  manualInUSD: number;
  manualInLBP: number;
  manualOutUSD: number;
  manualOutLBP: number;
  changeOutUSD: number;
  changeOutLBP: number;
  reopenUSD: number;
  reopenLBP: number;
  expectedClosingUSD: number;
  expectedClosingLBP: number;
  eventCount: number;
};

export async function computeShiftTotals(
  db: DatabaseReader,
  shift: Doc<"shifts">
): Promise<ShiftTotals> {
  const events = await db
    .query("shiftCashEvents")
    .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
    .collect();

  const totals: ShiftTotals = {
    salesUSD: 0,
    salesLBP: 0,
    returnsUSD: 0,
    returnsLBP: 0,
    manualInUSD: 0,
    manualInLBP: 0,
    manualOutUSD: 0,
    manualOutLBP: 0,
    changeOutUSD: 0,
    changeOutLBP: 0,
    reopenUSD: 0,
    reopenLBP: 0,
    expectedClosingUSD: 0,
    expectedClosingLBP: 0,
    eventCount: events.length,
  };

  for (const e of events) {
    switch (e.type) {
      case "sale":
        totals.salesUSD += e.amountUSD;
        totals.salesLBP += e.amountLBP;
        break;
      case "return":
        totals.returnsUSD += e.amountUSD;
        totals.returnsLBP += e.amountLBP;
        break;
      case "manual_in":
        totals.manualInUSD += e.amountUSD;
        totals.manualInLBP += e.amountLBP;
        break;
      case "manual_out":
        totals.manualOutUSD += e.amountUSD;
        totals.manualOutLBP += e.amountLBP;
        break;
      case "change_out":
        totals.changeOutUSD += e.amountUSD;
        totals.changeOutLBP += e.amountLBP;
        break;
      case "reopen_adjustment":
        totals.reopenUSD += e.amountUSD;
        totals.reopenLBP += e.amountLBP;
        break;
    }
  }

  totals.expectedClosingUSD =
    shift.openingUSD +
    totals.salesUSD +
    totals.returnsUSD +
    totals.manualInUSD +
    totals.manualOutUSD +
    totals.changeOutUSD +
    totals.reopenUSD;
  totals.expectedClosingLBP =
    shift.openingLBP +
    totals.salesLBP +
    totals.returnsLBP +
    totals.manualInLBP +
    totals.manualOutLBP +
    totals.changeOutLBP +
    totals.reopenLBP;

  return totals;
}
