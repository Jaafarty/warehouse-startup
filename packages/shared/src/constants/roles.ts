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
