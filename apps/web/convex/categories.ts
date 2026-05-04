import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPageFunction } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

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
      throw new ConvexError({ code: "CONFLICT", message: "A category with this name already exists." });
    }

    const id = await ctx.db.insert("categories", {
      storeId: args.storeId,
      name: args.name,
      description: args.description,
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "category.create",
      entityType: "category",
      entityId: id,
      details: { name: args.name },
    });

    return id;
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
    if (!category) throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });

    await assertPageFunction(ctx.db, args.userId, category.storeId, "inventory", "edit_category");

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.description !== undefined) patch.description = args.description;

    if (Object.keys(patch).length === 0) return { success: true };

    await ctx.db.patch(args.categoryId, patch);

    await createAuditLog(ctx.db, {
      storeId: category.storeId,
      userId: args.userId,
      action: "category.update",
      entityType: "category",
      entityId: args.categoryId,
      details: { name: args.name ?? category.name, description: args.description },
    });

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
    if (!category) throw new ConvexError({ code: "NOT_FOUND", message: "Category not found." });

    await assertPageFunction(ctx.db, args.userId, category.storeId, "inventory", "remove_category");

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

    await createAuditLog(ctx.db, {
      storeId: category.storeId,
      userId: args.userId,
      action: "category.remove",
      entityType: "category",
      entityId: args.categoryId,
      details: { name: category.name },
    });

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
