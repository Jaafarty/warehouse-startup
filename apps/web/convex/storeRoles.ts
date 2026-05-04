import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPageFunction, mergeWithDefaults } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";
import { PAGE_KEYS, PAGE_FUNCTIONS, LOCKED_FUNCTIONS, FUNCTION_DEPENDENCIES } from "@ware-house/shared";

const permissionsFunctionValidator = v.object(
  Object.fromEntries(
    PAGE_KEYS.map((page) => [
      page,
      v.object({
        enabled: v.boolean(),
        functions: v.object(
          Object.fromEntries(PAGE_FUNCTIONS[page].map((fn) => [fn, v.boolean()]))
        ),
      }),
    ])
  )
);

function coercePermissions(perms: any): any {
  // Deep copy
  const p = JSON.parse(JSON.stringify(perms));
  // 1. Lock functions: for any enabled page, force its locked functions to true
  for (const page of PAGE_KEYS) {
    if (p[page]?.enabled) {
      for (const fn of (LOCKED_FUNCTIONS[page] ?? [])) {
        p[page].functions[fn] = true;
      }
    }
  }
  // 2. Dependencies: if a "when" fn is true, force all "requires" to be enabled+true
  for (const dep of FUNCTION_DEPENDENCIES) {
    const [whenPage, whenFn] = dep.when;
    if (p[whenPage]?.enabled && p[whenPage]?.functions?.[whenFn]) {
      for (const [reqPage, reqFn] of dep.requires) {
        if (!p[reqPage]) p[reqPage] = { enabled: false, functions: {} };
        p[reqPage].enabled = true;
        if (!p[reqPage].functions) p[reqPage].functions = {};
        p[reqPage].functions[reqFn] = true;
      }
    }
  }
  return p;
}

export const listByStore = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "roles", "view_list");

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
      permissions: mergeWithDefaults(role.permissions),
      memberCount: allMembers.filter((m: any) => m.customRoleId === role._id).length,
    }));
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    permissions: permissionsFunctionValidator,
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "roles", "create_role");

    if (!args.name.trim()) {
      throw new ConvexError({ code: "INVALID", message: "Role name cannot be empty." });
    }

    const finalPermissions = mergeWithDefaults(coercePermissions(args.permissions));

    const roleId = await ctx.db.insert("storeRoles", {
      storeId: args.storeId,
      name: args.name.trim(),
      permissions: finalPermissions,
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
    permissions: v.optional(permissionsFunctionValidator),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "roles", "edit_role");

    const role = await ctx.db.get(args.roleId);
    if (!role || role.storeId !== args.storeId) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Role not found." });
    }

    const patch: Record<string, any> = {};
    if (args.name !== undefined) patch.name = args.name.trim();
    if (args.permissions !== undefined) patch.permissions = mergeWithDefaults(coercePermissions(args.permissions));

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
    await assertPageFunction(ctx.db, args.userId, args.storeId, "roles", "remove_role");

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
