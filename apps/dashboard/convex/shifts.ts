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
  computeRegisterDrawer,
  getActiveShiftFor,
  recordCashEvent,
} from "./_helpers/shifts";

/** True when the store has at least one active (selectable) register. */
async function storeHasActiveRegister(
  db: import("./_generated/server").DatabaseReader,
  storeId: Id<"stores">
): Promise<boolean> {
  const first = await db
    .query("registers")
    .withIndex("by_store_and_active", (q) =>
      q.eq("storeId", storeId).eq("isActive", true)
    )
    .first();
  return first !== null;
}

/** The open shift currently holding a register, or null. */
async function getOpenShiftForRegister(
  db: import("./_generated/server").DatabaseReader,
  registerId: Id<"registers">
): Promise<Doc<"shifts"> | null> {
  return db
    .query("shifts")
    .withIndex("by_register_and_status", (q) =>
      q.eq("registerId", registerId).eq("status", "open")
    )
    .first();
}

/** Returns the caller's currently-open shift, or null. */
export const getActive = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    return getActiveShiftFor(ctx.db, args.userId, args.storeId);
  },
});

/**
 * Source shift for carry-over preview. Drawer is shared per register:
 * carry-over follows the last close on the SAME register, regardless of who
 * closed it. When no register is given (store has no registers defined) it
 * falls back to the store's last closed shift — the legacy single-drawer
 * behaviour.
 */
export const getCarryOverSource = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    registerId: v.optional(v.id("registers")),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "shifts",
      "open_shift"
    );
    const last = await findLastClosedShift(
      ctx.db,
      args.storeId,
      args.registerId
    );
    if (!last) return null;
    const closer = last.closedBy ? await ctx.db.get(last.closedBy) : null;
    return {
      countedUSD: last.countedUSD ?? null,
      countedLBP: last.countedLBP ?? null,
      closedByName: closer?.name ?? null,
    };
  },
});

/** Last closed shift on a register (if given) or store-wide otherwise. */
async function findLastClosedShift(
  db: import("./_generated/server").DatabaseReader,
  storeId: Id<"stores">,
  registerId: Id<"registers"> | undefined
): Promise<Doc<"shifts"> | null> {
  if (registerId) {
    return db
      .query("shifts")
      .withIndex("by_register_and_status", (q) =>
        q.eq("registerId", registerId).eq("status", "closed")
      )
      .order("desc")
      .first();
  }
  return db
    .query("shifts")
    .withIndex("by_store_and_status", (q) =>
      q.eq("storeId", storeId).eq("status", "closed")
    )
    .order("desc")
    .first();
}

export const open = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    openingUSD: v.float64(),
    openingLBP: v.float64(),
    carryOver: v.boolean(),
    registerId: v.optional(v.id("registers")),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "shifts",
      "open_shift"
    );

    if (args.openingUSD < 0 || args.openingLBP < 0) {
      throw new ConvexError({
        code: "INVALID",
        message: "Opening cash cannot be negative.",
      });
    }

    // Resolve which register this shift opens on. When the store has any active
    // register, a selection is required; otherwise the store uses the implicit
    // single drawer and registerId must stay empty.
    const hasActiveRegister = await storeHasActiveRegister(
      ctx.db,
      args.storeId
    );
    let registerId: Id<"registers"> | undefined = undefined;
    if (hasActiveRegister) {
      if (!args.registerId) {
        throw new ConvexError({
          code: "REGISTER_REQUIRED",
          message: "Select a register to open a shift on.",
        });
      }
      const register = await ctx.db.get(args.registerId);
      if (
        !register ||
        register.storeId !== args.storeId ||
        !register.isActive
      ) {
        throw new ConvexError({
          code: "INVALID",
          message: "That register is not available.",
        });
      }
      const registerOpen = await getOpenShiftForRegister(
        ctx.db,
        args.registerId
      );
      if (registerOpen) {
        throw new ConvexError({
          code: "CONFLICT",
          message:
            "This register already has an open shift. It must be closed before opening another on this register.",
        });
      }
      registerId = args.registerId;
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
      // Carry over from the last closed shift on the same register (or the
      // store's last closed shift when no register is in play).
      const last = await findLastClosedShift(ctx.db, args.storeId, registerId);
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
      registerId,
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
      details: { openingUSD, openingLBP, carriedOver, exchangeRate: rate, registerId },
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

    // Guard: cashier can only have one open shift at a time. Without this,
    // reopening a closed shift while another is already open silently creates
    // two active shifts and breaks getActive() (unique() throws).
    const cashierOpen = await getActiveShiftFor(
      ctx.db,
      shift.openedBy,
      shift.storeId
    );
    if (cashierOpen) {
      const cashier = await ctx.db.get(shift.openedBy);
      const cashierName = cashier?.name ?? "this cashier";
      throw new ConvexError({
        code: "CONFLICT",
        message: `${cashierName} already has another open shift (#${cashierOpen._id.slice(-6)}). Close that shift first before reopening this one.`,
      });
    }

    // Guard: a register holds one open shift at a time. Someone else may have
    // opened this register since this shift closed — reopening would create
    // two open shifts on the same register.
    if (shift.registerId) {
      const registerOpen = await getOpenShiftForRegister(
        ctx.db,
        shift.registerId
      );
      if (registerOpen) {
        const register = await ctx.db.get(shift.registerId);
        throw new ConvexError({
          code: "CONFLICT",
          message: `${register?.name ?? "This register"} already has an open shift. Close it before reopening this one.`,
        });
      }
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
      registerId: shift.registerId,
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

    const activeShift = await getActiveShiftFor(
      ctx.db,
      args.userId,
      args.storeId
    );

    // With registers defined, manual cash targets the register held by the
    // caller's open shift — so we need to know which register. Require an
    // active shift.
    const hasActiveRegister = await storeHasActiveRegister(
      ctx.db,
      args.storeId
    );
    if (hasActiveRegister && !activeShift) {
      throw new ConvexError({
        code: "NO_ACTIVE_SHIFT",
        message: "Open a shift on a register before recording cash in/out.",
      });
    }
    const registerId = activeShift?.registerId;

    if (args.direction === "out") {
      // Validate against the specific register's balance when one is in play,
      // otherwise the store-wide drawer (legacy single-drawer stores).
      const { drawerUSD, drawerLBP } = registerId
        ? await computeRegisterDrawer(ctx.db, registerId)
        : await computeStoreDrawer(ctx.db, args.storeId);
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

    const sign = args.direction === "in" ? 1 : -1;
    const eventId = await recordCashEvent(ctx.db, {
      storeId: args.storeId,
      shiftId: activeShift?._id,
      registerId,
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
    const registerCache: Record<Id<"registers">, string> = {} as Record<
      Id<"registers">,
      string
    >;
    const enriched = await Promise.all(
      result.page.map(async (s) => {
        if (!userCache[s.openedBy]) {
          const u = await ctx.db.get(s.openedBy);
          userCache[s.openedBy] = u?.name ?? "Unknown";
        }
        let registerName: string | null = null;
        if (s.registerId) {
          if (!registerCache[s.registerId]) {
            const r = await ctx.db.get(s.registerId);
            registerCache[s.registerId] = r?.name ?? "—";
          }
          registerName = registerCache[s.registerId];
        }
        return { ...s, openedByName: userCache[s.openedBy], registerName };
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
    const register = shift.registerId
      ? await ctx.db.get(shift.registerId)
      : null;

    return {
      ...shift,
      openedByName: opener?.name ?? "Unknown",
      closedByName: closer?.name ?? null,
      registerName: register?.name ?? null,
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

/**
 * Per-register drawer balances for the cash page. Returns one entry per active
 * register with its running balance and the open shift holding it (if any).
 * Empty when the store has no registers (callers fall back to getStoreDrawer).
 */
export const getRegisterDrawers = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "cash",
      "view_list"
    );
    const registers = await ctx.db
      .query("registers")
      .withIndex("by_store_and_active", (q) =>
        q.eq("storeId", args.storeId).eq("isActive", true)
      )
      .collect();

    return Promise.all(
      registers.map(async (register) => {
        const { drawerUSD, drawerLBP } = await computeRegisterDrawer(
          ctx.db,
          register._id
        );
        const openShift = await getOpenShiftForRegister(ctx.db, register._id);
        let openedByName: string | null = null;
        if (openShift) {
          const u = await ctx.db.get(openShift.openedBy);
          openedByName = u?.name ?? "Unknown";
        }
        return {
          registerId: register._id,
          name: register.name,
          drawerUSD,
          drawerLBP,
          openShift: openShift
            ? { shiftId: openShift._id, openedByName }
            : null,
        };
      })
    );
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
