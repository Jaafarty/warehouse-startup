# Roles & Permissions Redesign

**Date:** 2026-05-01  
**Status:** Approved

## Overview

Expand the role system from 3 built-in roles to a 4-tier hierarchy (owner > admin > employee > viewer) plus owner/admin-created custom roles with a page+function permission tree. Each role can only manage roles below it in the pyramid. Replace raw Convex error strings with friendly toast messages throughout.

---

## 1. Role System

### Built-in System Roles (hardcoded, never stored as custom)

| Role | Assigned by | Unique powers |
|------|-------------|---------------|
| `owner` | Auto on store creation | Delete store, manage all roles, cannot be removed or reassigned |
| `admin` | Owner only | Manage employee/viewer/custom roles |
| `employee` | Owner or admin | Default working role (renamed from `editor`) |
| `viewer` | Owner or admin | Read-only access |

### Custom Roles

- Created by owner or admin via `/store/[storeId]/roles` page
- Stored in new `storeRoles` table
- Carry a full `StorePermissions` tree
- Can be assigned to any member (by owner or admin)

### Pyramid Enforcement

| Actor | Can assign to others |
|-------|---------------------|
| owner | admin, employee, viewer, any custom |
| admin | employee, viewer, any custom |
| employee / viewer / custom | nothing |

---

## 2. Permissions Model

### Shape

```ts
type PagePermissions = {
  enabled: boolean
  functions: Record<string, boolean>
}

type StorePermissions = Record<string, PagePermissions>
```

Page disabled → page hidden from sidebar, all sub-routes redirect. Function disabled → UI element hidden + backend rejects.

### Pages and Functions

| Page key | Functions |
|----------|-----------|
| `inventory` | `view_list`, `add_product`, `edit_product`, `archive_product`, `import_export`, `adjust_stock`, `view_history`, `create_category` |
| `sales` | `view_list`, `create_sale`, `view_detail` |
| `returns` | `view_list`, `process_return`, `view_detail` |
| `analytics` | `view_analytics`, `export_csv` |
| `members` | `view_members`, `invite_member`, `change_role`, `remove_member` |
| `settings` | `view_settings`, `edit_settings` |

### Default Permissions per Built-in Role

**owner / admin** — all pages enabled, all functions enabled.

**employee:**

| Page | Enabled | Functions |
|------|---------|-----------|
| inventory | ✓ | view_list, add_product, edit_product, adjust_stock, view_history, create_category |
| sales | ✓ | all |
| returns | ✓ | all |
| analytics | ✓ | view_analytics only |
| members | ✓ | view_members only |
| settings | ✗ | — |

**viewer:**

| Page | Enabled | Functions |
|------|---------|-----------|
| inventory | ✓ | view_list, view_history |
| sales | ✓ | view_list, view_detail |
| returns | ✓ | view_list, view_detail |
| analytics | ✓ | view_analytics only |
| members | ✗ | — |
| settings | ✗ | — |

### Permission Resolution Order

1. `owner` → hardcoded full permissions
2. `admin` → hardcoded full permissions
3. `employee` / `viewer` → hardcoded defaults from `packages/shared/src/constants/permissions.ts`
4. `custom` → load `StorePermissions` from `storeRoles` table by `customRoleId`

---

## 3. Schema Changes

### `storeMembers` table

```ts
// role field changes from "admin" | "editor" | "viewer" to:
role: "owner" | "admin" | "employee" | "viewer" | "custom"
customRoleId?: Id<"storeRoles">  // required when role === "custom"
```

Remove the `permissions` embedded object from `storeMembers` — permissions are now resolved at query time from the role.

### New `storeRoles` table

```ts
storeRoles: defineTable({
  storeId: v.id("stores"),
  name: v.string(),
  permissions: v.object({ /* StorePermissions tree */ }),
  createdBy: v.id("users"),
  createdAt: v.number(),
}).index("by_store", ["storeId"])
```

### Migration Script (one-time Convex mutation)

- For each store: find the member whose `userId` matches the store's `createdBy` field (or earliest `joinedAt` admin) → set their role to `"owner"`
- All remaining `"admin"` rows stay `"admin"`
- All `"editor"` rows → `"employee"`
- Remove `permissions` field from all `storeMembers` rows

---

## 4. Backend Changes

### `convex/_helpers/permissions.ts`

- Replace `assertStorePermission(module, level)` with `assertPageFunction(page, fnKey)`
- Add `getEffectivePermissions(member)` — resolves permissions based on role type
- `assertStoreMember` stays for membership-only checks

### `convex/members.ts`

- `updateRole` — enforce pyramid: caller role must be higher than target's new role
- `remove` — owner cannot be removed
- New mutations: `createCustomRole`, `updateCustomRole`, `deleteCustomRole`, `listCustomRoles`

### `convex/stores.ts`

- `create` — assign `"owner"` role (not `"admin"`) to creator
- Add `deleteStore` mutation — owner only

### Error Handling

All mutations throw `ConvexError({ code: string, message: string })` with user-friendly messages instead of plain `Error`. Examples:

| Thrown when | `message` |
|-------------|-----------|
| Not a member | "You no longer have access to this store." |
| Insufficient permission | "You don't have permission to do that." |
| Trying to change owner role | "The store owner's role cannot be changed." |
| Removing owner | "The store owner cannot be removed." |
| Assigning role above own | "You can't assign a role equal to or above your own." |
| Deleting role with members | "Remove all members from this role before deleting it." |

Client catches `ConvexError`, reads `error.data.message`, shows via `toast.error(...)`.

---

## 5. Frontend Changes

### New Page: `/store/[storeId]/roles`

- Accessible: owner and admin only
- Sidebar entry between Members and Settings
- Lists custom roles with member count badge
- Create role: name input + permission editor
- Permission editor: page rows with master enable/disable toggle; expand each page to reveal per-function checkboxes
- Edit role: same editor pre-filled
- Delete role: disabled if members assigned (show count, link to members page)

### Members Page (`/store/[storeId]/members`)

- Role dropdown groups: System (Admin, Employee, Viewer) | Custom Roles (divider + list)
- Owner entry: role shown as "Owner", no role change dropdown, no remove button
- Admin entry visible to owner only for role-change; admin cannot change other admins
- Role assignment respects pyramid (UI hides ineligible options; backend double-checks)

### Permission Enforcement in UI

- Sidebar links hidden when page is disabled for current user
- Action buttons (Add Product, Create Sale, etc.) hidden when function is disabled
- Route-level: if user navigates directly to a disabled page, show "Access Denied" with back button

### Toast Errors

- All mutation call sites wrapped in try/catch
- `catch (err) { if (err instanceof ConvexError) toast.error(err.data.message) }`
- Generic fallback: "Something went wrong. Please try again."

---

## 6. Shared Package Changes

`packages/shared/src/constants/`:
- `roles.ts` — export `ROLES = ["owner", "admin", "employee", "viewer"] as const`
- `permissions.ts` — export `DEFAULT_PERMISSIONS` map keyed by role, using new `StorePermissions` shape
- `pages.ts` (new) — export `PAGES` and `PAGE_FUNCTIONS` definitions

---

## Out of Scope

- Transferring ownership
- Multiple owners per store
- Per-member permission overrides (custom roles handle this)
- Audit log changes (existing audit.ts logs role changes as-is)
