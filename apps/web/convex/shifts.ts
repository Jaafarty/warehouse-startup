import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import {
  assertPageFunction,
  getStoreMember,
} from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";
import { getCurrentRate } from "./_helpers/exchangeRate";
import {
  computeShiftTotals,
  computeStoreDrawer,
  getActiveShiftFor,
  recordCashEvent,
} from "./_helpers/shifts";

/** Returns the caller's currently-open shift, or null. */
export const getActive = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    // Page-locked function — every member with shifts page enabled can read
    // their own active shift. Skip the assertion when feature is off.
    const store = await ctx.db.get(args.storeId);
    if (!store?.shiftsEnabled) return null;
    return getActiveShiftFor(ctx.db, args.userId, args.storeId);
  },
});

/** Caller's last closed shift in this store (used for carry-over preview). */
export const getLastClosedForUser = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("shifts")
      .withIndex("by_store_user_status", (q) =>
        q
          .eq("storeId", args.storeId)
          .eq("openedBy", args.userId)
          .eq("status", "closed")
      )
      .order("desc")
      .first();
  },
});

export const open = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    openingUSD: v.float64(),
    openingLBP: v.float64(),
    carryOver: v.boolean(),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "shifts",
      "open_shift"
    );

    const storeRow = await ctx.db.get(args.storeId);
    if (!storeRow?.shiftsEnabled) {
      throw new ConvexError({
        code: "FEATURE_DISABLED",
        message: "Shifts are disabled for this store. Enable them in settings first.",
      });
    }

    if (args.openingUSD < 0 || args.openingLBP < 0) {
      throw new ConvexError({
        code: "INVALID",
        message: "Opening cash cannot be negative.",
      });
    }

    const existingOpen = await getActiveShiftFor(
      ctx.db,
      args.userId,
      args.storeId
    );
    if (existingOpen) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "You already have an open shift. Close it before opening a new one.",
      });
    }

    let openingUSD = args.openingUSD;
    let openingLBP = args.openingLBP;
    let carriedOver = false;
    if (args.carryOver) {
      const last = await ctx.db
        .query("shifts")
        .withIndex("by_store_user_status", (q) =>
          q
            .eq("storeId", args.storeId)
            .eq("openedBy", args.userId)
            .eq("status", "closed")
        )
        .order("desc")
        .first();
      if (last && last.countedUSD !== undefined && last.countedLBP !== undefined) {
        openingUSD = last.countedUSD;
        openingLBP = last.countedLBP;
        carriedOver = true;
      }
    }

    const rate = await getCurrentRate(ctx.db, args.storeId);
    const now = Date.now();

    const shiftId = await ctx.db.insert("shifts", {
      storeId: args.storeId,
      openedBy: args.userId,
      status: "open",
      openingUSD,
      openingLBP,
      openingExchangeRate: rate,
      carriedOver,
      openedAt: now,
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "shift.open",
      entityType: "shift",
      entityId: shiftId,
      details: { openingUSD, openingLBP, carriedOver, exchangeRate: rate },
    });

    return { shiftId };
  },
});

export const close = mutation({
  args: {
    shiftId: v.id("shifts"),
    userId: v.id("users"),
    countedUSD: v.float64(),
    countedLBP: v.float64(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Shift not found." });
    }
    if (shift.status !== "open") {
      throw new ConvexError({
        code: "INVALID",
        message: "This shift is already closed.",
      });
    }

    // Only the cashier who opened it (with close_shift) can close it. Admins
    // and owners with view_all can also close it on a cashier's behalf.
    const isOwnShift = shift.openedBy === args.userId;
    if (isOwnShift) {
      await assertPageFunction(
        ctx.db,
        args.userId,
        shift.storeId,
        "shifts",
        "close_shift"
      );
    } else {
      const caller = await getStoreMember(ctx.db, args.userId, shift.storeId);
      if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
        throw new ConvexError({
          code: "FORBIDDEN",
          message: "Only the cashier who opened this shift can close it.",
        });
      }
      await assertPageFunction(
        ctx.db,
        args.userId,
        shift.storeId,
        "shifts",
        "view_all"
      );
    }

    if (args.countedUSD < 0 || args.countedLBP < 0) {
      throw new ConvexError({
        code: "INVALID",
        message: "Counted cash cannot be negative.",
      });
    }

    const totals = await computeShiftTotals(ctx.db, shift);
    const discrepancyUSD = args.countedUSD - totals.expectedClosingUSD;
    const discrepancyLBP = args.countedLBP - totals.expectedClosingLBP;

    const note = args.note?.trim() || undefined;
    const hasDiscrepancy =
      Math.abs(discrepancyUSD) > 0.005 || Math.abs(discrepancyLBP) >= 1;
    if (hasDiscrepancy && !note) {
      throw new ConvexError({
        code: "DISCREPANCY_NOTE_REQUIRED",
        message:
          "There is a discrepancy between counted and expected. Add a note explaining it.",
      });
    }

    const now = Date.now();
    await ctx.db.patch(args.shiftId, {
      status: "closed",
      closedBy: args.userId,
      closedAt: now,
      countedUSD: args.countedUSD,
      countedLBP: args.countedLBP,
      expectedClosingUSD: totals.expectedClosingUSD,
      expectedClosingLBP: totals.expectedClosingLBP,
      discrepancyUSD,
      discrepancyLBP,
      discrepancyNote: note,
    });

    await createAuditLog(ctx.db, {
      storeId: shift.storeId,
      userId: args.userId,
      action: "shift.close",
      entityType: "shift",
      entityId: args.shiftId,
      details: {
        countedUSD: args.countedUSD,
        countedLBP: args.countedLBP,
        expectedClosingUSD: totals.expectedClosingUSD,
        expectedClosingLBP: totals.expectedClosingLBP,
        discrepancyUSD,
        discrepancyLBP,
        note,
      },
    });

    return { success: true };
  },
});

export const reopen = mutation({
  args: {
    shiftId: v.id("shifts"),
    userId: v.id("users"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Shift not found." });
    }
    if (shift.status !== "closed") {
      throw new ConvexError({
        code: "INVALID",
        message: "Only closed shifts can be reopened.",
      });
    }
    await assertPageFunction(
      ctx.db,
      args.userId,
      shift.storeId,
      "shifts",
      "reopen_shift"
    );

    const reason = args.reason.trim();
    if (!reason) {
      throw new ConvexError({
        code: "INVALID",
        message: "A reason is required to reopen a shift.",
      });
    }

    await ctx.db.patch(args.shiftId, {
      status: "open",
      closedBy: undefined,
      closedAt: undefined,
      countedUSD: undefined,
      countedLBP: undefined,
      expectedClosingUSD: undefined,
      expectedClosingLBP: undefined,
      discrepancyUSD: undefined,
      discrepancyLBP: undefined,
      discrepancyNote: undefined,
    });

    await recordCashEvent(ctx.db, {
      storeId: shift.storeId,
      shiftId: args.shiftId,
      type: "reopen_adjustment",
      amountUSD: 0,
      amountLBP: 0,
      reason,
      performedBy: args.userId,
    });

    await createAuditLog(ctx.db, {
      storeId: shift.storeId,
      userId: args.userId,
      action: "shift.reopen",
      entityType: "shift",
      entityId: args.shiftId,
      details: { reason },
    });

    return { success: true };
  },
});

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

/** Caller's own shifts (paginated, newest first). */
export const listMine = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "shifts",
      "view_own"
    );
    return ctx.db
      .query("shifts")
      .withIndex("by_store_and_user", (q) =>
        q.eq("storeId", args.storeId).eq("openedBy", args.userId)
      )
      .order("desc")
      .paginate(args.paginationOpts);
  },
});

/** Every shift in the store — requires view_all. Includes cashier name. */
export const listAll = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "shifts",
      "view_all"
    );
    const result = await ctx.db
      .query("shifts")
      .withIndex("by_store_and_date", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .paginate(args.paginationOpts);

    const userCache: Record<Id<"users">, string> = {} as Record<
      Id<"users">,
      string
    >;
    const enriched = await Promise.all(
      result.page.map(async (s) => {
        if (!userCache[s.openedBy]) {
          const u = await ctx.db.get(s.openedBy);
          userCache[s.openedBy] = u?.name ?? "Unknown";
        }
        return { ...s, openedByName: userCache[s.openedBy] };
      })
    );

    return { ...result, page: enriched };
  },
});

/** Detail view: shift row + computed totals + recent events. */
export const get = query({
  args: { shiftId: v.id("shifts"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const shift = await ctx.db.get(args.shiftId);
    if (!shift) return null;

    // view_own is enough when it's the caller's own shift; otherwise need view_all.
    const isOwnShift = shift.openedBy === args.userId;
    if (isOwnShift) {
      await assertPageFunction(
        ctx.db,
        args.userId,
        shift.storeId,
        "shifts",
        "view_own"
      );
    } else {
      await assertPageFunction(
        ctx.db,
        args.userId,
        shift.storeId,
        "shifts",
        "view_all"
      );
    }

    const totals = await computeShiftTotals(ctx.db, shift);
    const events = await ctx.db
      .query("shiftCashEvents")
      .withIndex("by_shift", (q) => q.eq("shiftId", shift._id))
      .order("desc")
      .take(200);

    const userCache: Record<Id<"users">, string> = {} as Record<
      Id<"users">,
      string
    >;
    const eventsEnriched = await Promise.all(
      events.map(async (e: Doc<"shiftCashEvents">) => {
        if (!userCache[e.performedBy]) {
          const u = await ctx.db.get(e.performedBy);
          userCache[e.performedBy] = u?.name ?? "Unknown";
        }
        return { ...e, performedByName: userCache[e.performedBy] };
      })
    );

    const opener = await ctx.db.get(shift.openedBy);
    const closer = shift.closedBy ? await ctx.db.get(shift.closedBy) : null;

    return {
      ...shift,
      openedByName: opener?.name ?? "Unknown",
      closedByName: closer?.name ?? null,
      totals,
      events: eventsEnriched,
    };
  },
});

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
    const filtered = await ctx.db
      .query("shiftCashEvents")
      .withIndex("by_store_and_date", (q) => q.eq("storeId", args.storeId))
      .filter((q) =>
        q.or(
          q.eq(q.field("type"), "manual_in"),
          q.eq(q.field("type"), "manual_out")
        )
      )
      .order("desc")
      .take(take);

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
