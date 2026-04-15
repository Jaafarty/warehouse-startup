import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

export const listByStore = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    // Verify caller is a member
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "members",
      "view"
    );

    const members = await ctx.db
      .query("storeMembers")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    // Enrich with user info
    return Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        return {
          ...m,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "Unknown",
        };
      })
    );
  },
});

export const updateRole = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    targetMemberId: v.id("storeMembers"),
    newRole: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "members",
      "manage"
    );

    const target = await ctx.db.get(args.targetMemberId);
    if (!target || target.storeId !== args.storeId) {
      throw new Error("Member not found in this store");
    }

    // Cannot change own role
    if (target.userId === args.userId) {
      throw new Error("Cannot change your own role");
    }

    const defaultPerms = {
      admin: {
        inventory: "full" as const,
        sales: "full" as const,
        analytics: "view" as const,
        members: "manage" as const,
      },
      editor: {
        inventory: "edit" as const,
        sales: "edit" as const,
        analytics: "view" as const,
        members: "view" as const,
      },
      viewer: {
        inventory: "view" as const,
        sales: "view" as const,
        analytics: "view" as const,
        members: "none" as const,
      },
    };

    await ctx.db.patch(args.targetMemberId, {
      role: args.newRole,
      permissions: defaultPerms[args.newRole],
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "member.update_role",
      entityType: "member",
      entityId: args.targetMemberId,
      details: { newRole: args.newRole, targetUserId: target.userId },
    });

    return { success: true };
  },
});

export const remove = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    targetMemberId: v.id("storeMembers"),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "members",
      "manage"
    );

    const target = await ctx.db.get(args.targetMemberId);
    if (!target || target.storeId !== args.storeId) {
      throw new Error("Member not found in this store");
    }

    if (target.userId === args.userId) {
      throw new Error("Cannot remove yourself from the store");
    }

    // Check if target is the store owner
    const store = await ctx.db.get(args.storeId);
    if (store && store.ownerId === target.userId) {
      throw new Error("Cannot remove the store owner");
    }

    await ctx.db.delete(args.targetMemberId);

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "member.remove",
      entityType: "member",
      entityId: args.targetMemberId,
      details: { removedUserId: target.userId },
    });

    return { success: true };
  },
});
