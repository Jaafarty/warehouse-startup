import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getStoreMember } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

async function assertCanManageRoles(ctx: any, userId: any, storeId: any) {
  const member = await getStoreMember(ctx.db, userId, storeId);
  if (!member || (member.role !== "owner" && member.role !== "admin")) {
    throw new ConvexError({ code: "FORBIDDEN", message: "Only owners and admins can manage custom roles." });
  }
  return member;
}

export const listByStore = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const member = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!member) throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });

    const roles = await ctx.db
      .query("storeRoles")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    // Count members assigned each custom role
    const allMembers = await ctx.db
      .query("storeMembers")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    return roles.map((role: any) => ({
      ...role,
      memberCount: allMembers.filter((m: any) => m.customRoleId === role._id).length,
    }));
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    permissions: v.any(),
  },
  handler: async (ctx, args) => {
    await assertCanManageRoles(ctx, args.userId, args.storeId);

    if (!args.name.trim()) {
      throw new ConvexError({ code: "INVALID", message: "Role name cannot be empty." });
    }

    const roleId = await ctx.db.insert("storeRoles", {
      storeId: args.storeId,
      name: args.name.trim(),
      permissions: args.permissions,
      createdBy: args.userId,
      createdAt: Date.now(),
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "role.create",
      entityType: "storeRole",
      entityId: roleId,
      details: { name: args.name },
    });

    return roleId;
  },
});

export const update = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    roleId: v.id("storeRoles"),
    name: v.optional(v.string()),
    permissions: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await assertCanManageRoles(ctx, args.userId, args.storeId);

    const role = await ctx.db.get(args.roleId);
    if (!role || role.storeId !== args.storeId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Role not found." });
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.permissions !== undefined) patch.permissions = args.permissions;

    await ctx.db.patch(args.roleId, patch);

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "role.update",
      entityType: "storeRole",
      entityId: args.roleId,
      details: patch,
    });

    return { success: true };
  },
});

export const remove = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    roleId: v.id("storeRoles"),
  },
  handler: async (ctx, args) => {
    await assertCanManageRoles(ctx, args.userId, args.storeId);

    const role = await ctx.db.get(args.roleId);
    if (!role || role.storeId !== args.storeId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Role not found." });
    }

    // Prevent deletion if members are assigned this role
    const membersWithRole = await ctx.db
      .query("storeMembers")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .filter((q: any) => q.eq(q.field("customRoleId"), args.roleId))
      .collect();

    if (membersWithRole.length > 0) {
      throw new ConvexError({
        code: "CONFLICT",
        message: `Remove all members from this role before deleting it (${membersWithRole.length} assigned).`,
      });
    }

    await ctx.db.delete(args.roleId);

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "role.delete",
      entityType: "storeRole",
      entityId: args.roleId,
      details: { name: role.name },
    });

    return { success: true };
  },
});
