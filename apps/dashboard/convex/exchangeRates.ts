import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { assertPageFunction, assertAnyPageFunction } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";
import { getCurrentRateRow } from "./_helpers/exchangeRate";

export const getCurrent = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertAnyPageFunction(ctx.db, args.userId, args.storeId, [
      ["exchange_rate", "view_list"],
      ["sales", "create_sale"],
    ]);
    const row = await getCurrentRateRow(ctx.db, args.storeId);
    if (!row) return null;
    const creator = await ctx.db.get(row.createdBy);
    return { ...row, createdByName: creator?.name ?? "Unknown" };
  },
});

export const listHistory = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "exchange_rate", "view_list");

    const result = await ctx.db
      .query("exchangeRates")
      .withIndex("by_store_and_effective", (q) =>
        q.eq("storeId", args.storeId)
      )
      .order("desc")
      .paginate(args.paginationOpts);

    const withCreator = await Promise.all(
      result.page.map(async (row) => {
        const creator = await ctx.db.get(row.createdBy);
        return {
          ...row,
          createdByName: creator?.name ?? "Unknown",
        };
      })
    );

    return { ...result, page: withCreator };
  },
});

export const setRate = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rate: v.float64(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.rate) || args.rate <= 0) {
      throw new ConvexError({ code: "INVALID", message: "Rate must be a positive number." });
    }

    await assertPageFunction(ctx.db, args.userId, args.storeId, "exchange_rate", "set_rate");

    const now = Date.now();
    const id = await ctx.db.insert("exchangeRates", {
      storeId: args.storeId,
      rate: args.rate,
      effectiveFrom: now,
      note: args.note,
      createdBy: args.userId,
      createdAt: now,
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "exchangeRate.set",
      entityType: "exchangeRate",
      entityId: id,
      details: { rate: args.rate, note: args.note },
    });

    return id;
  },
});
