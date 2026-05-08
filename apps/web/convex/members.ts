import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { getStoreMember } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";
import { canManageRole, MemberRole } from "@ware-house/shared";

export const listByStore = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!caller) throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });

    const members = await ctx.db
      .query("storeMembers")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    return Promise.all(
      members.map(async (m) => {
        const user = await ctx.db.get(m.userId);
        let customRoleName: string | undefined;
        if (m.role === "custom" && m.customRoleId) {
          const customRole = await ctx.db.get(m.customRoleId);
          customRoleName = customRole?.name;
        }
        return {
          ...m,
          userName: user?.name ?? "Unknown",
          userEmail: user?.email ?? "Unknown",
          customRoleName,
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
      v.literal("employee"),
      v.literal("viewer"),
      v.literal("custom")
    ),
    customRoleId: v.optional(v.id("storeRoles")),
  },
  handler: async (ctx, args) => {
    const caller = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!caller) throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });

    if (caller.role !== "owner" && caller.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only owners and admins can change member roles." });
    }

    const target = await ctx.db.get(args.targetMemberId);
    if (!target || target.storeId !== args.storeId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Member not found in this store." });
    }

    if (target.userId === args.userId) {
      throw new ConvexError({ code: "INVALID", message: "You cannot change your own role." });
    }

    if (target.role === "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "The store owner's role cannot be changed." });
    }

    // Pyramid: caller must outrank target's current role AND the new role being assigned
    if (!canManageRole(caller.role as MemberRole, target.role as MemberRole)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can't modify a member with a role equal to or above your own." });
    }
    if (!canManageRole(caller.role as MemberRole, args.newRole as MemberRole)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can't assign a role equal to or above your own." });
    }

    if (args.newRole === "custom" && !args.customRoleId) {
      throw new ConvexError({ code: "INVALID", message: "A custom role ID is required when assigning a custom role." });
    }

    const patch: {
      role: typeof args.newRole;
      customRoleId?: Id<"storeRoles">;
    } = { role: args.newRole };
    if (args.newRole === "custom") {
      patch.customRoleId = args.customRoleId;
    } else {
      patch.customRoleId = undefined;
    }

    await ctx.db.patch(args.targetMemberId, patch);

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
    const caller = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!caller) throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });

    if (caller.role !== "owner" && caller.role !== "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Only owners and admins can remove members." });
    }

    const target = await ctx.db.get(args.targetMemberId);
    if (!target || target.storeId !== args.storeId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Member not found in this store." });
    }

    if (target.userId === args.userId) {
      throw new ConvexError({ code: "INVALID", message: "You cannot remove yourself from the store." });
    }

    if (target.role === "owner") {
      throw new ConvexError({ code: "FORBIDDEN", message: "The store owner cannot be removed." });
    }

    if (!canManageRole(caller.role as MemberRole, target.role as MemberRole)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can't remove a member with a role equal to or above your own." });
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
