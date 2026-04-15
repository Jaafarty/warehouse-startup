import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { createAuditLog } from "./_helpers/audit";

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const storeId = await ctx.db.insert("stores", {
      name: args.name,
      description: args.description,
      ownerId: args.userId,
      isActive: true,
      createdAt: now,
    });

    // Creator becomes admin with full permissions
    await ctx.db.insert("storeMembers", {
      storeId,
      userId: args.userId,
      role: "admin",
      permissions: {
        inventory: "full",
        sales: "full",
        analytics: "view",
        members: "manage",
      },
      joinedAt: now,
    });

    await createAuditLog(ctx.db, {
      storeId,
      userId: args.userId,
      action: "store.create",
      entityType: "store",
      entityId: storeId,
      details: { name: args.name },
    });

    return storeId;
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const memberships = await ctx.db
      .query("storeMembers")
      .withIndex("by_user", (q: any) => q.eq("userId", args.userId))
      .collect();

    const stores = await Promise.all(
      memberships.map(async (m) => {
        const store = await ctx.db.get(m.storeId);
        return store ? { ...store, role: m.role, permissions: m.permissions } : null;
      })
    );

    return stores.filter((s): s is NonNullable<typeof s> => s !== null && s.isActive);
  },
});

export const getById = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store || !store.isActive) return null;

    const member = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q: any) =>
        q.eq("storeId", args.storeId).eq("userId", args.userId)
      )
      .unique();

    if (!member) return null;

    return { ...store, role: member.role, permissions: member.permissions };
  },
});

export const update = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store) throw new Error("Store not found");

    // Only owner or admin can update
    const member = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q: any) =>
        q.eq("storeId", args.storeId).eq("userId", args.userId)
      )
      .unique();

    if (!member || member.role !== "admin") {
      throw new Error("Only admins can update store settings");
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;

    await ctx.db.patch(args.storeId, patch);

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "store.update",
      entityType: "store",
      entityId: args.storeId,
      details: patch,
    });

    return { success: true };
  },
});
