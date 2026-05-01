import { v, ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import { getStoreMember } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";
import { getCurrentRateRow } from "./_helpers/exchangeRate";

export const getCurrent = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!member) return null;
    return getCurrentRateRow(ctx.db, args.storeId);
  },
});

export const listHistory = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const member = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!member) {
      return { page: [], isDone: true, continueCursor: "" };
    }

    const result = await ctx.db
      .query("exchangeRates")
      .withIndex("by_store_and_effective", (q: any) =>
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

    const member = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!member) throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });
    if (member.role !== "admin" && member.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins and the owner can change the exchange rate." });
    }

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
