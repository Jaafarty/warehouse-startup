import { DatabaseReader } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

type ModuleKey = "inventory" | "sales" | "analytics" | "members";
type PermissionLevel = "none" | "view" | "edit" | "full" | "manage";

const LEVEL_HIERARCHY: Record<string, number> = {
  none: 0,
  view: 1,
  edit: 2,
  full: 3,
  manage: 3,
};

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

export async function assertStorePermission(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">,
  module: ModuleKey,
  requiredLevel: PermissionLevel
): Promise<Doc<"storeMembers">> {
  const member = await getStoreMember(db, userId, storeId);

  if (!member) {
    throw new Error("Not a member of this store");
  }

  const userLevel = LEVEL_HIERARCHY[member.permissions[module]] ?? 0;
  const required = LEVEL_HIERARCHY[requiredLevel] ?? 0;

  if (userLevel < required) {
    throw new Error(`Insufficient ${module} permissions`);
  }

  return member;
}

export async function assertStoreMember(
  db: DatabaseReader,
  userId: Id<"users">,
  storeId: Id<"stores">
): Promise<Doc<"storeMembers">> {
  const member = await getStoreMember(db, userId, storeId);
  if (!member) {
    throw new Error("Not a member of this store");
  }
  return member;
}
