import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { createAuditLog } from "./_helpers/audit";
import { getEffectivePermissions } from "./_helpers/permissions";

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

    await ctx.db.insert("storeMembers", {
      storeId,
      userId: args.userId,
      role: "owner",
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
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const stores = await Promise.all(
      memberships.map(async (m) => {
        const store = await ctx.db.get(m.storeId);
        if (!store || !store.isActive) return null;
        const effectivePermissions = await getEffectivePermissions(ctx.db, m);
        return { ...store, role: m.role, effectivePermissions };
      })
    );

    return stores.filter((s): s is NonNullable<typeof s> => s !== null);
  },
});

export const getById = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const store = await ctx.db.get(args.storeId);
    if (!store || !store.isActive) return null;

    const member = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q) =>
        q.eq("storeId", args.storeId).eq("userId", args.userId)
      )
      .unique();

    if (!member) return null;

    const effectivePermissions = await getEffectivePermissions(ctx.db, member);
    return { ...store, role: member.role, effectivePermissions };
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
    if (!store) throw new ConvexError({ code: "NOT_FOUND", message: "Store not found." });

    const member = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q) =>
        q.eq("storeId", args.storeId).eq("userId", args.userId)
      )
      .unique();

    if (!member || (member.role !== "admin" && member.role !== "owner")) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only admins and the owner can update store settings." });
    }

    const patch: Partial<Doc<"stores">> = {};
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

export const deleteStore = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q) =>
        q.eq("storeId", args.storeId).eq("userId", args.userId)
      )
      .unique();

    if (!member || member.role !== "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only the store owner can delete the store." });
    }

    await ctx.db.patch(args.storeId, { isActive: false });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "store.delete",
      entityType: "store",
      entityId: args.storeId,
      details: {},
    });

    return { success: true };
  },
});
