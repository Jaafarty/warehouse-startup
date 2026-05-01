import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPageFunction } from "./_helpers/permissions";

export const list = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "view_list");
    return ctx.db
      .query("categories")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "create_category");

    // Check for duplicate name
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_store_and_name", (q: any) =>
        q.eq("storeId", args.storeId).eq("name", args.name)
      )
      .unique();

    if (existing) {
      throw new Error("A category with this name already exists");
    }

    return ctx.db.insert("categories", {
      storeId: args.storeId,
      name: args.name,
      description: args.description,
    });
  },
});

export const update = mutation({
  args: {
    categoryId: v.id("categories"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");

    await assertPageFunction(ctx.db, args.userId, category.storeId, "inventory", "create_category");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;

    await ctx.db.patch(args.categoryId, patch);
    return { success: true };
  },
});

export const remove = mutation({
  args: {
    categoryId: v.id("categories"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.categoryId);
    if (!category) throw new Error("Category not found");

    await assertPageFunction(ctx.db, args.userId, category.storeId, "inventory", "create_category");

    // Remove category reference from products
    const products = await ctx.db
      .query("products")
      .withIndex("by_store_and_category", (q: any) =>
        q.eq("storeId", category.storeId).eq("categoryId", args.categoryId)
      )
      .collect();

    for (const product of products) {
      await ctx.db.patch(product._id, { categoryId: undefined });
    }

    await ctx.db.delete(args.categoryId);
    return { success: true };
  },
});

export const ensureMany = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "create_category");

    if (args.names.length === 0) return {};

    // Fetch all at once for batched lookup; one round-trip beats one-per-name.
    const existing = await ctx.db
      .query("categories")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    const byLowerName = new Map<string, any>(
      existing.map((c: any) => [c.name.toLowerCase(), c._id])
    );

    const result: Record<string, any> = {};
    const seen = new Set<string>();

    for (const raw of args.names) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let id = byLowerName.get(key);
      if (!id) {
        id = await ctx.db.insert("categories", {
          storeId: args.storeId,
          name,
        });
      }
      result[key] = id;
    }

    return result;
  },
});
