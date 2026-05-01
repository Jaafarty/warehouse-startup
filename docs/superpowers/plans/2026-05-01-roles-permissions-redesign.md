# Roles & Permissions Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner role, 4-tier hierarchy with pyramid enforcement, custom role builder, page+function permission tree, and friendly ConvexError toasts.

**Architecture:** Permissions move from a module-level string map embedded on `storeMembers` to a page+function boolean tree resolved at runtime from the member's role. Built-in roles use hardcoded defaults from `packages/shared`. Custom roles store their tree in a new `storeRoles` table. Schema migrated with widen → migrate → narrow strategy.

**Tech Stack:** Convex (schema, queries, mutations, ConvexError), Next.js App Router, shadcn/ui v4, TypeScript, packages/shared

---

## File Map

**Create:**
- `packages/shared/src/constants/pages.ts` — page keys + function keys + type definitions
- `apps/web/convex/storeRoles.ts` — CRUD for custom roles
- `apps/web/convex/migrations.ts` — one-time migration mutation
- `apps/web/app/(dashboard)/store/[storeId]/roles/page.tsx` — custom roles management page

**Modify:**
- `packages/shared/src/constants/roles.ts` — add owner, employee; remove editor
- `packages/shared/src/constants/permissions.ts` — replace module levels with StorePermissions tree
- `packages/shared/src/index.ts` — export new pages constants
- `apps/web/convex/schema.ts` — widen (task 2), then narrow (task 8)
- `apps/web/convex/_helpers/permissions.ts` — replace with page+function helpers + ConvexError
- `apps/web/convex/stores.ts` — owner on create, effectivePermissions in getById, deleteStore
- `apps/web/convex/members.ts` — pyramid enforcement, ConvexError, owner protection
- `apps/web/convex/invitations.ts` — new role literals, accept creates member with new schema
- `apps/web/convex/products.ts` — replace assertStorePermission calls
- `apps/web/convex/categories.ts` — replace assertStorePermission calls
- `apps/web/convex/stockMovements.ts` — replace assertStorePermission calls
- `apps/web/convex/sales.ts` — replace assertStorePermission calls
- `apps/web/convex/returns.ts` — replace assertStorePermission calls
- `apps/web/convex/customers.ts` — replace assertStorePermission calls
- `apps/web/convex/analytics.ts` — replace assertStorePermission calls
- `apps/web/app/actions/stores.ts` — ConvexError handling, new role types, new actions
- `apps/web/components/layout/sidebar.tsx` — new StorePermissions prop
- `apps/web/app/(dashboard)/store/[storeId]/layout.tsx` — pass effectivePermissions
- `apps/web/app/(dashboard)/store/[storeId]/members/page.tsx` — pyramid UI, owner row, custom roles

---

## Task 1: Shared Package — New Types and Constants

**Files:**
- Modify: `packages/shared/src/constants/roles.ts`
- Modify: `packages/shared/src/constants/permissions.ts`
- Create: `packages/shared/src/constants/pages.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Replace roles.ts**

```typescript
// packages/shared/src/constants/roles.ts
export const SYSTEM_ROLES = ["owner", "admin"] as const;
export const DEFAULT_ROLES = ["employee", "viewer"] as const;
export const BUILT_IN_ROLES = [...SYSTEM_ROLES, ...DEFAULT_ROLES] as const;

export type SystemRole = (typeof SYSTEM_ROLES)[number];
export type BuiltInRole = (typeof BUILT_IN_ROLES)[number];
export type MemberRole = BuiltInRole | "custom";

export const ROLE_HIERARCHY: Record<BuiltInRole, number> = {
  owner: 4,
  admin: 3,
  employee: 2,
  viewer: 1,
};

export function canManageRole(actorRole: MemberRole, targetRole: MemberRole): boolean {
  if (actorRole === "custom" || targetRole === "owner") return false;
  if (targetRole === "custom") return actorRole === "owner" || actorRole === "admin";
  const actorLevel = ROLE_HIERARCHY[actorRole as BuiltInRole] ?? 0;
  const targetLevel = ROLE_HIERARCHY[targetRole as BuiltInRole] ?? 0;
  return actorLevel > targetLevel;
}
```

- [ ] **Step 2: Create pages.ts**

```typescript
// packages/shared/src/constants/pages.ts
export const PAGE_KEYS = [
  "inventory",
  "sales",
  "returns",
  "analytics",
  "members",
  "settings",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_FUNCTIONS: Record<PageKey, readonly string[]> = {
  inventory: [
    "view_list",
    "add_product",
    "edit_product",
    "archive_product",
    "import_export",
    "adjust_stock",
    "view_history",
    "create_category",
  ],
  sales: ["view_list", "create_sale", "view_detail"],
  returns: ["view_list", "process_return", "view_detail"],
  analytics: ["view_analytics", "export_csv"],
  members: ["view_members", "invite_member", "change_role", "remove_member"],
  settings: ["view_settings", "edit_settings"],
};

export type PagePermissions = {
  enabled: boolean;
  functions: Record<string, boolean>;
};

export type StorePermissions = Record<PageKey, PagePermissions>;

function makePage(enabled: boolean, fns: readonly string[], enabledFns: string[]): PagePermissions {
  const functions: Record<string, boolean> = {};
  for (const fn of fns) {
    functions[fn] = enabledFns.includes(fn);
  }
  return { enabled, functions };
}

export const DEFAULT_PERMISSIONS: Record<BuiltInRole, StorePermissions> = {
  owner: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, [...PAGE_FUNCTIONS.inventory]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, [...PAGE_FUNCTIONS.sales]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, [...PAGE_FUNCTIONS.returns]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, [...PAGE_FUNCTIONS.analytics]),
    members: makePage(true, PAGE_FUNCTIONS.members, [...PAGE_FUNCTIONS.members]),
    settings: makePage(true, PAGE_FUNCTIONS.settings, [...PAGE_FUNCTIONS.settings]),
  },
  admin: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, [...PAGE_FUNCTIONS.inventory]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, [...PAGE_FUNCTIONS.sales]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, [...PAGE_FUNCTIONS.returns]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, [...PAGE_FUNCTIONS.analytics]),
    members: makePage(true, PAGE_FUNCTIONS.members, [...PAGE_FUNCTIONS.members]),
    settings: makePage(true, PAGE_FUNCTIONS.settings, [...PAGE_FUNCTIONS.settings]),
  },
  employee: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, [
      "view_list", "add_product", "edit_product", "adjust_stock", "view_history", "create_category",
    ]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, [...PAGE_FUNCTIONS.sales]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, [...PAGE_FUNCTIONS.returns]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, ["view_analytics"]),
    members: makePage(true, PAGE_FUNCTIONS.members, ["view_members"]),
    settings: makePage(false, PAGE_FUNCTIONS.settings, []),
  },
  viewer: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, ["view_list", "view_history"]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, ["view_list", "view_detail"]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, ["view_list", "view_detail"]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, ["view_analytics"]),
    members: makePage(false, PAGE_FUNCTIONS.members, []),
    settings: makePage(false, PAGE_FUNCTIONS.settings, []),
  },
};

import type { BuiltInRole } from "./roles";
```

- [ ] **Step 3: Replace permissions.ts**

```typescript
// packages/shared/src/constants/permissions.ts
// Re-export everything from pages.ts for backwards compat of imports
export type { PageKey, PagePermissions, StorePermissions } from "./pages";
export { PAGE_KEYS, PAGE_FUNCTIONS, DEFAULT_PERMISSIONS } from "./pages";
```

- [ ] **Step 4: Update packages/shared/src/index.ts — add pages exports**

Read the current `packages/shared/src/index.ts` then add:
```typescript
export * from "./constants/pages";
export * from "./constants/roles";
```
(keep all existing exports, just append these if not already present)

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/constants/roles.ts packages/shared/src/constants/permissions.ts packages/shared/src/constants/pages.ts packages/shared/src/index.ts
git commit -m "feat(shared): add owner/employee roles and page+function permission tree"
```

---

## Task 2: Schema — Phase 1 Widen

**Files:**
- Modify: `apps/web/convex/schema.ts`

- [ ] **Step 1: Widen storeMembers — add new role literals, make permissions optional, add customRoleId**

In `schema.ts`, replace the `storeMembers` table definition:

```typescript
storeMembers: defineTable({
  storeId: v.id("stores"),
  userId: v.id("users"),
  role: v.union(
    v.literal("owner"),
    v.literal("admin"),
    v.literal("employee"),
    v.literal("editor"),    // kept during migration, removed in Task 8
    v.literal("viewer"),
    v.literal("custom")
  ),
  customRoleId: v.optional(v.id("storeRoles")),
  // permissions kept optional — old rows still valid, new rows omit it
  permissions: v.optional(v.object({
    inventory: v.union(v.literal("none"), v.literal("view"), v.literal("edit"), v.literal("full")),
    sales: v.union(v.literal("none"), v.literal("view"), v.literal("edit"), v.literal("full")),
    analytics: v.union(v.literal("none"), v.literal("view")),
    members: v.union(v.literal("none"), v.literal("view"), v.literal("manage")),
  })),
  joinedAt: v.float64(),
})
  .index("by_store", ["storeId"])
  .index("by_user", ["userId"])
  .index("by_store_and_user", ["storeId", "userId"]),
```

- [ ] **Step 2: Widen storeInvitations role field**

```typescript
storeInvitations: defineTable({
  storeId: v.id("stores"),
  email: v.string(),
  role: v.union(
    v.literal("admin"),
    v.literal("employee"),
    v.literal("editor"),    // kept during migration
    v.literal("viewer"),
    v.literal("custom")
  ),
  customRoleId: v.optional(v.id("storeRoles")),
  invitedBy: v.id("users"),
  token: v.string(),
  status: v.union(
    v.literal("pending"),
    v.literal("accepted"),
    v.literal("declined"),
    v.literal("expired")
  ),
  expiresAt: v.float64(),
})
  .index("by_store", ["storeId"])
  .index("by_email", ["email"])
  .index("by_token", ["token"])
  .index("by_store_and_email", ["storeId", "email"]),
```

- [ ] **Step 3: Add storeRoles table**

Add after `storeInvitations`:

```typescript
storeRoles: defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  permissions: v.any(), // StorePermissions tree — typed in application layer
  createdBy: v.id("users"),
  createdAt: v.float64(),
}).index("by_store", ["storeId"]),
```

- [ ] **Step 4: Verify Convex dev server accepts schema**

Run `npx convex dev` from `apps/web/`. Confirm no schema errors in terminal output.

- [ ] **Step 5: Commit**

```bash
git add apps/web/convex/schema.ts
git commit -m "feat(schema): widen storeMembers for new roles, add storeRoles table"
```

---

## Task 3: New Permissions Helper

**Files:**
- Modify: `apps/web/convex/_helpers/permissions.ts`

- [ ] **Step 1: Replace entire file**

```typescript
import { ConvexError } from "convex/values";
import { DatabaseReader } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { DEFAULT_PERMISSIONS, StorePermissions, BuiltInRole } from "@ware-house/shared";

export async function getStoreMember(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">
): Promise<Doc<"storeMembers"> | null> {
  return db
    .query("storeMembers")
    .withIndex("by_store_and_user", (q: any) =>
      q.eq("storeId", storeId).eq("userId", userId)
    )
    .unique();
}

export async function getEffectivePermissions(
  db: DatabaseReader,
  member: Doc<"storeMembers">
): Promise<StorePermissions> {
  const role = member.role as string;
  if (role === "owner" || role === "admin" || role === "employee" || role === "viewer") {
    // editor is legacy alias for employee
    const key = role === "editor" ? "employee" : role;
    return DEFAULT_PERMISSIONS[key as BuiltInRole];
  }
  if (role === "custom" && member.customRoleId) {
    const customRole = await db.get(member.customRoleId as Id<"storeRoles">);
    if (customRole) return customRole.permissions as StorePermissions;
  }
  return DEFAULT_PERMISSIONS.viewer;
}

export async function assertStoreMember(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">
): Promise<Doc<"storeMembers">> {
  const member = await getStoreMember(db, userId, storeId);
  if (!member) {
    throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });
  }
  return member;
}

export async function assertPageFunction(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">,
  page: string,
  fn: string
): Promise<Doc<"storeMembers">> {
  const member = await assertStoreMember(db, userId, storeId);
  const perms = await getEffectivePermissions(db, member);
  const pagePerms = perms[page as keyof typeof perms];
  if (!pagePerms?.enabled || !pagePerms.functions[fn]) {
    throw new ConvexError({ code: "FORBIDDEN", message: "You don't have permission to do that." });
  }
  return member;
}

// Legacy shim — used by files not yet migrated. Will be removed after Task 9.
export async function assertStorePermission(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">,
  _module: string,
  _level: string
): Promise<Doc<"storeMembers">> {
  return assertStoreMember(db, userId, storeId);
}
```

- [ ] **Step 2: Verify `npx convex dev` still compiles**

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/_helpers/permissions.ts
git commit -m "feat(convex): replace permissions helper with page+function tree + ConvexError"
```

---

## Task 4: Update stores.ts

**Files:**
- Modify: `apps/web/convex/stores.ts`

- [ ] **Step 1: Update `create` — assign owner role, no permissions field**

Replace the `storeMembers` insert in the `create` handler:

```typescript
await ctx.db.insert("storeMembers", {
  storeId,
  userId: args.userId,
  role: "owner",
  joinedAt: now,
});
```

- [ ] **Step 2: Update `getById` — return effectivePermissions**

Replace the handler body in `getById`:

```typescript
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

  const { getEffectivePermissions } = await import("./_helpers/permissions");
  const effectivePermissions = await getEffectivePermissions(ctx.db, member);

  return { ...store, role: member.role, effectivePermissions };
},
```

- [ ] **Step 3: Update `listByUser` — return effectivePermissions**

Replace the inner map in `listByUser`:

```typescript
memberships.map(async (m) => {
  const store = await ctx.db.get(m.storeId);
  if (!store || !store.isActive) return null;
  const { getEffectivePermissions } = await import("./_helpers/permissions");
  const effectivePermissions = await getEffectivePermissions(ctx.db, m);
  return { ...store, role: m.role, effectivePermissions };
})
```

- [ ] **Step 4: Update `update` — allow owner too**

Replace the permission check in `update`:

```typescript
if (!member || (member.role !== "admin" && member.role !== "owner")) {
  throw new ConvexError({ code: "FORBIDDEN", message: "Only admins and the owner can update store settings." });
}
```

Add import at top of file: `import { ConvexError } from "convex/values";`

- [ ] **Step 5: Add `deleteStore` mutation**

Add after the `update` mutation:

```typescript
export const deleteStore = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const member = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q: any) =>
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
```

- [ ] **Step 6: Verify `npx convex dev` compiles**

- [ ] **Step 7: Commit**

```bash
git add apps/web/convex/stores.ts
git commit -m "feat(convex): owner role on store create, effectivePermissions in getById, deleteStore"
```

---

## Task 5: Create storeRoles.ts

**Files:**
- Create: `apps/web/convex/storeRoles.ts`

- [ ] **Step 1: Create file**

```typescript
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
```

- [ ] **Step 2: Verify `npx convex dev` compiles**

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/storeRoles.ts
git commit -m "feat(convex): add storeRoles CRUD mutations and queries"
```

---

## Task 6: Rewrite members.ts

**Files:**
- Modify: `apps/web/convex/members.ts`

- [ ] **Step 1: Replace entire file**

```typescript
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getStoreMember } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";
import { canManageRole } from "@ware-house/shared";

export const listByStore = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const caller = await getStoreMember(ctx.db, args.userId, args.storeId);
    if (!caller) throw new ConvexError({ code: "NOT_MEMBER", message: "You no longer have access to this store." });

    const members = await ctx.db
      .query("storeMembers")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    return Promise.all(
      members.map(async (m: any) => {
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

    // Pyramid: caller must outrank the new role being assigned
    if (!canManageRole(caller.role as any, args.newRole as any)) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You can't assign a role equal to or above your own." });
    }

    if (args.newRole === "custom" && !args.customRoleId) {
      throw new ConvexError({ code: "INVALID", message: "A custom role ID is required when assigning a custom role." });
    }

    const patch: Record<string, any> = { role: args.newRole };
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

    // Admin cannot remove another admin (only owner can)
    if (caller.role === "admin" && target.role === "admin") {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admins cannot remove other admins." });
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
```

- [ ] **Step 2: Verify `npx convex dev` compiles**

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/members.ts
git commit -m "feat(convex): rewrite members.ts with pyramid enforcement and ConvexError"
```

---

## Task 7: Data Migration

**Files:**
- Create: `apps/web/convex/migrations.ts`

- [ ] **Step 1: Create migration file**

```typescript
import { mutation } from "./_generated/server";

// Run once: migrate editor→employee, assign owner to store creator
export const migrateRolesV2 = mutation({
  args: {},
  handler: async (ctx) => {
    const stores = await ctx.db.query("stores").collect();
    let migrated = 0;

    for (const store of stores) {
      const members = await ctx.db
        .query("storeMembers")
        .withIndex("by_store", (q: any) => q.eq("storeId", store._id))
        .collect();

      for (const member of members) {
        const patch: Record<string, any> = {};

        // Migrate editor → employee
        if ((member.role as string) === "editor") {
          patch.role = "employee";
        }

        // Assign owner to the store creator if no owner exists
        const hasOwner = members.some((m: any) => m.role === "owner");
        if (!hasOwner && member.userId === store.ownerId && member.role === "admin") {
          patch.role = "owner";
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(member._id, patch);
          migrated++;
        }
      }

      // Migrate invitations: editor → employee
      const invitations = await ctx.db
        .query("storeInvitations")
        .withIndex("by_store", (q: any) => q.eq("storeId", store._id))
        .collect();

      for (const invite of invitations) {
        if ((invite.role as string) === "editor") {
          await ctx.db.patch(invite._id, { role: "employee" });
          migrated++;
        }
      }
    }

    return { migrated };
  },
});
```

- [ ] **Step 2: Run migration via Convex dashboard or CLI**

```bash
# From apps/web/
npx convex run migrations:migrateRolesV2
```

Expected output: `{ migrated: N }` where N ≥ 0.

- [ ] **Step 3: Verify migration in Convex dashboard**

Open Convex dashboard → storeMembers table. Confirm:
- No rows with `role = "editor"`
- The store creator has `role = "owner"`
- Other admins still have `role = "admin"`

- [ ] **Step 4: Commit**

```bash
git add apps/web/convex/migrations.ts
git commit -m "feat(convex): migration script editor→employee, admin-creator→owner"
```

---

## Task 8: Schema — Phase 2 Narrow

**Files:**
- Modify: `apps/web/convex/schema.ts`

- [ ] **Step 1: Remove "editor" literal from storeMembers role**

```typescript
role: v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("employee"),
  v.literal("viewer"),
  v.literal("custom")
),
```

- [ ] **Step 2: Remove "editor" literal from storeInvitations role**

```typescript
role: v.union(
  v.literal("admin"),
  v.literal("employee"),
  v.literal("viewer"),
  v.literal("custom")
),
```

- [ ] **Step 3: Verify `npx convex dev` compiles with no errors**

If there are "existing documents don't match schema" errors, check migration ran fully.

- [ ] **Step 4: Commit**

```bash
git add apps/web/convex/schema.ts
git commit -m "feat(schema): narrow storeMembers/storeInvitations — remove legacy editor role"
```

---

## Task 9: Update All Other Convex Files

Replace legacy `assertStorePermission` calls with `assertPageFunction` in every domain file.

**Files:** `products.ts`, `categories.ts`, `stockMovements.ts`, `sales.ts`, `returns.ts`, `customers.ts`, `analytics.ts`

- [ ] **Step 1: Update products.ts**

Read `apps/web/convex/products.ts`. For each mutation/query, replace the assertStorePermission call with the matching assertPageFunction:

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "inventory", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "view_list")` |
| `assertStorePermission(..., "inventory", "edit")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "add_product")` for create, `"edit_product"` for update |
| `assertStorePermission(..., "inventory", "full")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "archive_product")` for archive |

Import change at top:
```typescript
import { assertPageFunction } from "./_helpers/permissions";
```

- [ ] **Step 2: Update categories.ts**

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "inventory", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "view_list")` |
| `assertStorePermission(..., "inventory", "edit")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "create_category")` |

- [ ] **Step 3: Update stockMovements.ts**

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "inventory", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "view_history")` |
| `assertStorePermission(..., "inventory", "edit")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "adjust_stock")` |

- [ ] **Step 4: Update sales.ts**

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "sales", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "view_list")` |
| `assertStorePermission(..., "sales", "edit")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "create_sale")` |

- [ ] **Step 5: Update returns.ts**

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "sales", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "returns", "view_list")` |
| `assertStorePermission(..., "sales", "edit")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "returns", "process_return")` |

- [ ] **Step 6: Update customers.ts**

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "sales", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "view_list")` |
| `assertStorePermission(..., "sales", "edit")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "create_sale")` |

- [ ] **Step 7: Update analytics.ts**

| Old call | Replace with |
|----------|-------------|
| `assertStorePermission(..., "analytics", "view")` | `assertPageFunction(ctx.db, args.userId, args.storeId, "analytics", "view_analytics")` |

- [ ] **Step 8: Verify `npx convex dev` compiles all files**

- [ ] **Step 9: Remove legacy shim from `_helpers/permissions.ts`**

Delete the `assertStorePermission` export added as legacy shim in Task 3.

- [ ] **Step 10: Commit**

```bash
git add apps/web/convex/products.ts apps/web/convex/categories.ts apps/web/convex/stockMovements.ts apps/web/convex/sales.ts apps/web/convex/returns.ts apps/web/convex/customers.ts apps/web/convex/analytics.ts apps/web/convex/_helpers/permissions.ts
git commit -m "feat(convex): migrate all domain files to assertPageFunction"
```

---

## Task 10: Update invitations.ts

**Files:**
- Modify: `apps/web/convex/invitations.ts`

- [ ] **Step 1: Update `create` mutation — new role arg + permission check**

Replace the role `v.union(...)` arg with:
```typescript
role: v.union(
  v.literal("admin"),
  v.literal("employee"),
  v.literal("viewer"),
  v.literal("custom")
),
customRoleId: v.optional(v.id("storeRoles")),
```

Replace the `assertStorePermission` call:
```typescript
const caller = await getStoreMember(ctx.db, args.userId, args.storeId);
if (!caller || (caller.role !== "owner" && caller.role !== "admin")) {
  throw new ConvexError({ code: "FORBIDDEN", message: "Only owners and admins can invite members." });
}
```

Update the `ctx.db.insert("storeInvitations", {...})` to include `customRoleId: args.customRoleId`.

- [ ] **Step 2: Update `accept` mutation — create member with new schema**

In `accept`, replace the `storeMembers` insert:
```typescript
await ctx.db.insert("storeMembers", {
  storeId: invite.storeId,
  userId: args.userId,
  role: invite.role,
  customRoleId: invite.customRoleId,
  joinedAt: Date.now(),
});
```

- [ ] **Step 3: Replace plain Error throws with ConvexError**

For each `throw new Error(...)` in `invitations.ts`, replace with:
```typescript
throw new ConvexError({ code: "INVALID", message: "<user-friendly message>" });
```

Mapping:
- "This user is already a member of the store" → "This person is already a member of this store."
- "An invitation is already pending for this email" → "An invitation is already pending for this email address."
- Token not found/expired → "This invitation link is invalid or has expired."

Add import: `import { ConvexError } from "convex/values";`

- [ ] **Step 4: Verify `npx convex dev` compiles**

- [ ] **Step 5: Commit**

```bash
git add apps/web/convex/invitations.ts
git commit -m "feat(convex): update invitations to new role schema and ConvexError"
```

---

## Task 11: Update Server Actions for ConvexError

**Files:**
- Modify: `apps/web/app/actions/stores.ts`

- [ ] **Step 1: Add ConvexError import and helper**

At the top of `apps/web/app/actions/stores.ts`:
```typescript
import { ConvexError } from "convex/values";

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as any;
    return data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
```

- [ ] **Step 2: Replace all error catch blocks**

In every `catch (error)` block that returns `{ success: false, error: error instanceof Error ? error.message : "..." }`, replace with:

```typescript
return { success: false, error: extractErrorMessage(error, "Failed to <action>") };
```

Apply to: `createStore`, `updateStore`, `inviteMember`, `updateMemberRole`, `removeMember`, `acceptInvitation`, `declineInvitation`.

- [ ] **Step 3: Update `inviteMember` role type**

Change:
```typescript
const role = formData.get("role") as "admin" | "editor" | "viewer";
```
To:
```typescript
const role = formData.get("role") as "admin" | "employee" | "viewer" | "custom";
const customRoleId = formData.get("customRoleId") as string | null;
```

Update the mutation call to include `customRoleId: customRoleId as any || undefined`.

- [ ] **Step 4: Update `updateMemberRole` type signature**

```typescript
export async function updateMemberRole(
  storeId: string,
  memberId: string,
  newRole: "admin" | "employee" | "viewer" | "custom",
  customRoleId?: string
)
```

Update the mutation call:
```typescript
await convex.mutation(api.members.updateRole, {
  storeId: storeId as any,
  userId,
  targetMemberId: memberId as any,
  newRole,
  customRoleId: customRoleId as any,
});
```

- [ ] **Step 5: Add `deleteStore` server action**

```typescript
export async function deleteStore(storeId: string) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.stores.deleteStore, {
      storeId: storeId as any,
      userId,
    });
    redirect("/dashboard");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { success: false, error: extractErrorMessage(error, "Failed to delete store") };
  }
}
```

- [ ] **Step 6: Verify TypeScript compiles — `npx next build` from apps/web**

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/actions/stores.ts
git commit -m "feat(actions): ConvexError handling, new role types, deleteStore action"
```

---

## Task 12: Update Layout and Sidebar

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/layout.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Update sidebar.tsx — new permissions prop**

Replace the `SidebarProps` interface:
```typescript
import type { StorePermissions } from "@ware-house/shared";

interface SidebarProps {
  storeId: string;
  storeName: string;
  role: string;
  permissions: StorePermissions;
}
```

Update the `links` array to use `permissions[key]?.enabled`:
```typescript
const links = [
  { href: base, label: "Dashboard", icon: LayoutDashboard, show: true },
  { href: `${base}/inventory`, label: "Inventory", icon: Package, show: permissions.inventory?.enabled ?? false },
  { href: `${base}/sales`, label: "Sales", icon: ShoppingCart, show: permissions.sales?.enabled ?? false },
  { href: `${base}/returns`, label: "Returns", icon: RotateCcw, show: permissions.returns?.enabled ?? false },
  { href: `${base}/analytics`, label: "Analytics", icon: BarChart3, show: permissions.analytics?.enabled ?? false },
  { href: `${base}/members`, label: "Members", icon: Users, show: permissions.members?.enabled ?? false },
  { href: `${base}/roles`, label: "Roles", icon: ShieldCheck, show: role === "owner" || role === "admin" },
  { href: `${base}/exchange-rate`, label: "Exchange Rate", icon: DollarSign, show: true },
  { href: `${base}/settings`, label: "Settings", icon: Settings, show: permissions.settings?.enabled ?? false },
];
```

Add `ShieldCheck` to the lucide-react import line.

- [ ] **Step 2: Update layout.tsx — pass role + effectivePermissions**

```typescript
if (!store) redirect("/dashboard");

return (
  <div className="flex h-[calc(100vh-3.5rem)]">
    <Sidebar
      storeId={storeId}
      storeName={store.name}
      role={store.role}
      permissions={store.effectivePermissions}
    />
    <div className="flex-1 overflow-auto">{children}</div>
  </div>
);
```

- [ ] **Step 3: Verify sidebar renders correctly — start dev server and open a store**

```bash
npm run dev
```

Navigate to a store. Confirm sidebar links show/hide based on role permissions.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx apps/web/app/(dashboard)/store/[storeId]/layout.tsx
git commit -m "feat(layout): sidebar uses page-based effectivePermissions from new role system"
```

---

## Task 13: Update Members Page

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/members/page.tsx`

- [ ] **Step 1: Add custom roles query**

Add after the `invitations` query:
```typescript
const customRoles = useQuery(
  api.storeRoles.listByStore,
  userId ? { storeId: storeId as any, userId: userId as any } : "skip"
);
```

Add import: `import { api } from "@/convex/_generated/api";` (already imported, just extend usage).

- [ ] **Step 2: Update handleRoleChange signature**

```typescript
async function handleRoleChange(
  memberId: string,
  newRole: "admin" | "employee" | "viewer" | "custom",
  customRoleId?: string
) {
  const result = await updateMemberRole(storeId, memberId, newRole, customRoleId);
  if (result.success) {
    toast.success("Role updated");
  } else {
    toast.error(result.error ?? "Failed to update role");
  }
}
```

- [ ] **Step 3: Update role badge to show new role names**

```typescript
const roleBadgeVariant = (role: string) => {
  switch (role) {
    case "owner": return "default" as const;
    case "admin": return "default" as const;
    case "employee": return "secondary" as const;
    default: return "outline" as const;
  }
};

function roleLabel(member: any): string {
  if (member.role === "custom") return member.customRoleName ?? "Custom";
  if (member.role === "employee") return "Employee";
  return member.role.charAt(0).toUpperCase() + member.role.slice(1);
}
```

- [ ] **Step 4: Update the member table rows**

For owner rows: show "Owner" badge, no dropdown (no role change, no remove button).

For admin rows (shown to owner only): show role change options (employee, viewer, custom only) + remove.

For employee/viewer/custom rows (shown to owner and admin): show role change + remove.

Replace the `<TableBody>` content:

```typescript
{members.map((member: any) => {
  const isOwner = member.role === "owner";
  const isSelf = member.userId === userId;
  const currentUserMember = members.find((m: any) => m.userId === userId);
  const currentUserRole = currentUserMember?.role ?? "viewer";
  const canEdit = !isOwner && !isSelf && (currentUserRole === "owner" || currentUserRole === "admin");
  // Admins can't edit other admins
  const canEditThisMember = canEdit && !(currentUserRole === "admin" && member.role === "admin");

  return (
    <TableRow key={member._id}>
      <TableCell className="font-medium">
        {member.userName}
        {isSelf && <span className="text-muted-foreground ml-1">(you)</span>}
      </TableCell>
      <TableCell>{member.userEmail}</TableCell>
      <TableCell>
        <Badge variant={roleBadgeVariant(member.role)}>
          {roleLabel(member)}
        </Badge>
      </TableCell>
      <TableCell>
        {canEditThisMember && (
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currentUserRole === "owner" && member.role !== "admin" && (
                <DropdownMenuItem onClick={() => handleRoleChange(member._id, "admin")}>
                  Make Admin
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => handleRoleChange(member._id, "employee")}>
                Make Employee
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleRoleChange(member._id, "viewer")}>
                Make Viewer
              </DropdownMenuItem>
              {customRoles && customRoles.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {customRoles.map((cr: any) => (
                    <DropdownMenuItem
                      key={cr._id}
                      onClick={() => handleRoleChange(member._id, "custom", cr._id)}
                    >
                      {cr.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              <DropdownMenuSeparator />
              <AlertDialog>
                <AlertDialogTrigger className="relative flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm text-destructive outline-none hover:bg-accent">
                  Remove
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remove member?</AlertDialogTitle>
                    <AlertDialogDescription>
                      {member.userName} will lose access to this store.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRemove(member._id)}>
                      Remove
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
})}
```

- [ ] **Step 5: Update invite dialog role options**

```typescript
<SelectContent>
  {currentUserRole === "owner" && (
    <SelectItem value="admin">Admin</SelectItem>
  )}
  <SelectItem value="employee">Employee</SelectItem>
  <SelectItem value="viewer">Viewer</SelectItem>
  {customRoles && customRoles.length > 0 && (
    <>
      <SelectItem disabled value="__divider__">── Custom Roles ──</SelectItem>
      {customRoles.map((cr: any) => (
        <SelectItem key={cr._id} value={`custom:${cr._id}`}>
          {cr.name}
        </SelectItem>
      ))}
    </>
  )}
</SelectContent>
```

In `handleInvite`, parse the role value:
```typescript
const rawRole = formData.get("role") as string;
const role = rawRole.startsWith("custom:") ? "custom" : rawRole as any;
const customRoleId = rawRole.startsWith("custom:") ? rawRole.split(":")[1] : undefined;
// Pass customRoleId in a hidden input or handle in formData
```

Alternative: use a controlled `useState` for the invite role instead of uncontrolled form field.

- [ ] **Step 6: Test in browser — verify pyramid rules work correctly**

Start dev server. Open members page as owner. Try making an admin. Open members page as admin. Confirm "Make Admin" is hidden. Confirm owner row has no dropdown.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/(dashboard)/store/[storeId]/members/page.tsx
git commit -m "feat(members): pyramid role UI, owner row protection, custom roles in dropdown"
```

---

## Task 14: New Roles Management Page

**Files:**
- Create: `apps/web/app/(dashboard)/store/[storeId]/roles/page.tsx`

- [ ] **Step 1: Create the roles page**

```typescript
"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ConvexError } from "convex/values";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { PAGE_KEYS, PAGE_FUNCTIONS, DEFAULT_PERMISSIONS } from "@ware-house/shared";
import type { StorePermissions } from "@ware-house/shared";

function buildEmptyPermissions(): StorePermissions {
  const perms: any = {};
  for (const page of PAGE_KEYS) {
    const functions: Record<string, boolean> = {};
    for (const fn of PAGE_FUNCTIONS[page]) {
      functions[fn] = false;
    }
    perms[page] = { enabled: false, functions };
  }
  return perms;
}

function PermissionEditor({
  permissions,
  onChange,
}: {
  permissions: StorePermissions;
  onChange: (p: StorePermissions) => void;
}) {
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());

  function togglePage(page: string) {
    setOpenPages((prev) => {
      const next = new Set(prev);
      next.has(page) ? next.delete(page) : next.add(page);
      return next;
    });
  }

  function setPageEnabled(page: string, enabled: boolean) {
    const updated = {
      ...permissions,
      [page]: { ...permissions[page as keyof StorePermissions], enabled },
    };
    onChange(updated as StorePermissions);
  }

  function setFunction(page: string, fn: string, value: boolean) {
    const pagePerms = permissions[page as keyof StorePermissions];
    const updated = {
      ...permissions,
      [page]: {
        ...pagePerms,
        functions: { ...pagePerms.functions, [fn]: value },
      },
    };
    onChange(updated as StorePermissions);
  }

  function formatLabel(key: string) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-2">
      {PAGE_KEYS.map((page) => {
        const pagePerms = permissions[page];
        const isOpen = openPages.has(page);
        return (
          <div key={page} className="border rounded-lg">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button onClick={() => togglePage(page)} className="text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <span className="font-medium capitalize">{page}</span>
              </div>
              <Switch
                checked={pagePerms.enabled}
                onCheckedChange={(v) => setPageEnabled(page, v)}
              />
            </div>
            {isOpen && pagePerms.enabled && (
              <div className="px-4 pb-3 space-y-2 border-t pt-3">
                {PAGE_FUNCTIONS[page].map((fn) => (
                  <div key={fn} className="flex items-center justify-between">
                    <Label className="text-sm font-normal">{formatLabel(fn)}</Label>
                    <Switch
                      checked={pagePerms.functions[fn] ?? false}
                      onCheckedChange={(v) => setFunction(page, fn, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RolesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const customRoles = useQuery(
    api.storeRoles.listByStore,
    userId ? { storeId: storeId as any, userId: userId as any } : "skip"
  );

  const createRole = useMutation(api.storeRoles.create);
  const updateRole = useMutation(api.storeRoles.update);
  const removeRole = useMutation(api.storeRoles.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<StorePermissions>(buildEmptyPermissions());
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setName("");
    setPermissions(buildEmptyPermissions());
    setCreateOpen(true);
  }

  function openEdit(role: any) {
    setName(role.name);
    setPermissions(role.permissions as StorePermissions);
    setEditingRole(role);
  }

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) { toast.error("Role name is required."); return; }
    setSaving(true);
    try {
      if (editingRole) {
        await updateRole({ storeId: storeId as any, userId: userId as any, roleId: editingRole._id, name, permissions });
        toast.success("Role updated");
        setEditingRole(null);
      } else {
        await createRole({ storeId: storeId as any, userId: userId as any, name, permissions });
        toast.success("Role created");
        setCreateOpen(false);
      }
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as any)?.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roleId: string) {
    if (!userId) return;
    try {
      await removeRole({ storeId: storeId as any, userId: userId as any, roleId: roleId as any });
      toast.success("Role deleted");
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as any)?.message : "Something went wrong.";
      toast.error(msg);
    }
  }

  const roleDialogContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Role Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cashier" />
      </div>
      <div className="space-y-2">
        <Label>Page Access</Label>
        <PermissionEditor permissions={permissions} onChange={setPermissions} />
      </div>
      <Button onClick={handleSave} className="w-full" disabled={saving}>
        {saving ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Roles</h1>
          <p className="text-muted-foreground">Create roles with specific page and feature access.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80">
            <Plus className="h-4 w-4 mr-2" /> New Role
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Custom Role</DialogTitle>
            </DialogHeader>
            {roleDialogContent}
          </DialogContent>
        </Dialog>
      </div>

      {customRoles === undefined ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : customRoles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center gap-3">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No custom roles yet</p>
            <p className="text-sm text-muted-foreground">Create roles to give members specific page access.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customRoles.map((role: any) => (
            <Card key={role._id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {role.memberCount}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingRole?._id === role._id} onOpenChange={(o) => !o && setEditingRole(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Role</DialogTitle>
                        </DialogHeader>
                        {roleDialogContent}
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{role.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {role.memberCount > 0
                              ? `${role.memberCount} member(s) have this role. Reassign them first.`
                              : "This cannot be undone."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={role.memberCount > 0}
                            onClick={() => handleDelete(role._id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {PAGE_KEYS.filter((p) => role.permissions[p]?.enabled).map((p) => (
                    <Badge key={p} variant="secondary" className="capitalize">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Check if shadcn Collapsible and Switch components exist**

```bash
ls apps/web/components/ui/switch.tsx apps/web/components/ui/collapsible.tsx 2>/dev/null || echo "missing"
```

If missing, install:
```bash
cd apps/web && npx shadcn@latest add switch collapsible
```

- [ ] **Step 3: Test in browser**

Start dev server. Navigate to `/store/[storeId]/roles`. Create a custom role with some pages enabled. Verify it appears in the list. Edit it. Assign it to a member from the members page. Try deleting (should fail with member count > 0).

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/store/[storeId]/roles/page.tsx
git commit -m "feat(ui): custom roles management page with permission editor"
```

---

## Self-Review Checklist

- [x] **owner role** — Task 4 (stores create), Task 7 (migration)
- [x] **pyramid enforcement** — Task 6 (members.ts updateRole/remove), Task 1 (canManageRole util)
- [x] **employee rename** — Task 1 (shared), Task 7 (migration), Task 8 (schema narrow)
- [x] **custom roles CRUD** — Task 5 (storeRoles.ts), Task 14 (roles page)
- [x] **page+function permissions** — Task 1 (pages.ts), Task 3 (helper), Task 9 (domain files)
- [x] **sidebar page visibility** — Task 12
- [x] **members page pyramid UI** — Task 13
- [x] **friendly toast errors (ConvexError)** — Task 3 (helper), Task 6 (members), Task 5 (storeRoles), Task 10 (invitations), Task 11 (server actions)
- [x] **deleteStore** — Task 4, Task 11
- [x] **migration script** — Task 7
- [x] **schema widen + narrow** — Tasks 2, 8
- [x] **Roles sidebar link** — Task 12 (ShieldCheck link added)
