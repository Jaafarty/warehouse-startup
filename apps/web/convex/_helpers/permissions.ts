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
  if (role === "owner" || role === "admin" || role === "employee" || role === "viewer" || role === "editor") {
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
