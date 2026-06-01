import { ConvexError } from "convex/values";
import { DatabaseReader } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { DEFAULT_PERMISSIONS, StorePermissions, BuiltInRole, BUILT_IN_ROLES, PAGE_KEYS, PAGE_FUNCTIONS } from "@ware-house/shared";

export async function getStoreMember(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">
): Promise<Doc<"storeMembers"> | null> {
  return db
    .query("storeMembers")
    .withIndex("by_store_and_user", (q) =>
      q.eq("storeId", storeId).eq("userId", userId)
    )
    .unique();
}

export async function getEffectivePermissions(
  db: DatabaseReader,
  member: Doc<"storeMembers">
): Promise<StorePermissions> {
  const role = member.role as string;
  const legacyBuiltIns: readonly string[] = [...BUILT_IN_ROLES, "editor"];
  if (legacyBuiltIns.includes(role)) {
    // editor is legacy alias for employee
    const key = role === "editor" ? "employee" : role;
    return DEFAULT_PERMISSIONS[key as BuiltInRole];
  }
  if (role === "custom") {
    if (!member.customRoleId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "You don't have permission to do that." });
    }
    const customRole = await db.get(member.customRoleId as Id<"storeRoles">);
    if (!customRole) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Your assigned role no longer exists." });
    }
    return mergeWithDefaults(customRole.permissions);
  }
  throw new ConvexError({ code: "FORBIDDEN", message: "Unrecognized role. Contact your store owner." });
}

type StoredPagePerm = { enabled?: boolean; functions?: Record<string, boolean> };

export function mergeWithDefaults(stored: Doc<"storeRoles">["permissions"]): StorePermissions {
  const tree = (stored ?? {}) as Record<string, StoredPagePerm | undefined>;
  const result: Record<string, { enabled: boolean; functions: Record<string, boolean> }> = {};
  for (const page of PAGE_KEYS) {
    const storedPage = tree[page];
    const fns: Record<string, boolean> = {};
    for (const fn of PAGE_FUNCTIONS[page]) {
      fns[fn] = storedPage?.functions?.[fn] ?? false;
    }
    result[page] = {
      enabled: storedPage?.enabled ?? false,
      functions: fns,
    };
  }
  return result as StorePermissions;
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

export async function assertAnyPageFunction(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">,
  options: Array<[string, string]>
): Promise<Doc<"storeMembers">> {
  const member = await assertStoreMember(db, userId, storeId);
  const perms = await getEffectivePermissions(db, member);
  for (const [page, fn] of options) {
    const pagePerms = perms[page as keyof typeof perms];
    if (pagePerms?.enabled && pagePerms.functions[fn]) {
      return member;
    }
  }
  throw new ConvexError({ code: "FORBIDDEN", message: "You don't have permission to do that." });
}
