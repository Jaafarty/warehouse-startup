import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { assertPageFunction } from "./_helpers/permissions";
import { adjustStock } from "./_helpers/stock";

export const listByProduct = query({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await assertPageFunction(ctx.db, args.userId, product.storeId, "inventory", "view_history");

    const movements = await ctx.db
      .query("stockMovements")
      .withIndex("by_product", (q: any) => q.eq("productId", args.productId))
      .order("desc")
      .collect();

    // Attach performer names
    const userIds = [...new Set(movements.map((m: any) => m.performedBy as Id<"users">))];
    const users: Record<string, string> = {};
    for (const uid of userIds) {
      const user = await ctx.db.get(uid);
      if (user) users[String(uid)] = user.name;
    }

    return movements.map((m: any) => ({
      ...m,
      performedByName: users[m.performedBy] ?? "Unknown",
    }));
  },
});

export const listByStore = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    type: v.optional(
      v.union(
        v.literal("sale"),
        v.literal("return"),
        v.literal("manual_add"),
        v.literal("manual_remove"),
        v.literal("adjustment"),
        v.literal("initial")
      )
    ),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "view_history");

    let movements;

    if (args.type) {
      movements = await ctx.db
        .query("stockMovements")
        .withIndex("by_store_and_type", (q: any) =>
          q.eq("storeId", args.storeId).eq("type", args.type)
        )
        .order("desc")
        .take(200);
    } else {
      movements = await ctx.db
        .query("stockMovements")
        .withIndex("by_store_and_timestamp", (q: any) =>
          q.eq("storeId", args.storeId)
        )
        .order("desc")
        .take(200);
    }

    // Attach product and user names
    const productCache: Record<string, string> = {};
    const userCache: Record<string, string> = {};

    for (const m of movements) {
      if (!productCache[m.productId]) {
        const p = await ctx.db.get(m.productId);
        productCache[m.productId] = p?.name ?? "Deleted product";
      }
      if (!userCache[m.performedBy]) {
        const u = await ctx.db.get(m.performedBy);
        userCache[m.performedBy] = u?.name ?? "Unknown";
      }
    }

    return movements.map((m: any) => ({
      ...m,
      productName: productCache[m.productId],
      performedByName: userCache[m.performedBy],
    }));
  },
});

export const manualAdjust = mutation({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
    type: v.union(v.literal("manual_add"), v.literal("manual_remove")),
    quantity: v.number(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await assertPageFunction(ctx.db, args.userId, product.storeId, "inventory", "adjust_stock");

    if (args.quantity <= 0) {
      throw new Error("Quantity must be positive");
    }

    const quantityChange =
      args.type === "manual_add" ? args.quantity : -args.quantity;

    return adjustStock(ctx.db, {
      storeId: product.storeId,
      productId: args.productId,
      type: args.type,
      quantityChange,
      performedBy: args.userId,
      referenceType: "manual",
      note: args.note,
    });
  },
});
