import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPageFunction } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

export const list = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "view_list");

    const all = await ctx.db
      .query("customers")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    const term = (args.search ?? "").trim().toLowerCase();
    if (!term) return all;

    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term)
    );
  },
});

export const getByPhone = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "view_list");

    return await ctx.db
      .query("customers")
      .withIndex("by_store_and_phone", (q) =>
        q.eq("storeId", args.storeId).eq("phone", args.phone)
      )
      .unique();
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "create_sale");

    const name = args.name.trim();
    const phone = args.phone.trim();

    if (!name) throw new ConvexError({ code: "VALIDATION", message: "Name is required" });
    if (!phone) throw new ConvexError({ code: "VALIDATION", message: "Phone is required" });

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_store_and_phone", (q) =>
        q.eq("storeId", args.storeId).eq("phone", phone)
      )
      .unique();

    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "A customer with this phone already exists",
      });
    }

    const now = Date.now();
    const customerId = await ctx.db.insert("customers", {
      storeId: args.storeId,
      name,
      phone,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "customer_created",
      entityType: "customer",
      entityId: customerId,
      details: { name, phone },
    });

    return { customerId };
  },
});
