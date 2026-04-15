import type { Role } from "./roles";

export const INVENTORY_LEVELS = ["none", "view", "edit", "full"] as const;
export const SALES_LEVELS = ["none", "view", "edit", "full"] as const;
export const ANALYTICS_LEVELS = ["none", "view"] as const;
export const MEMBERS_LEVELS = ["none", "view", "manage"] as const;

export type InventoryPermission = (typeof INVENTORY_LEVELS)[number];
export type SalesPermission = (typeof SALES_LEVELS)[number];
export type AnalyticsPermission = (typeof ANALYTICS_LEVELS)[number];
export type MembersPermission = (typeof MEMBERS_LEVELS)[number];

export interface ModulePermissions {
  inventory: InventoryPermission;
  sales: SalesPermission;
  analytics: AnalyticsPermission;
  members: MembersPermission;
}

export const DEFAULT_PERMISSIONS: Record<Role, ModulePermissions> = {
  admin: {
    inventory: "full",
    sales: "full",
    analytics: "view",
    members: "manage",
  },
  editor: {
    inventory: "edit",
    sales: "edit",
    analytics: "view",
    members: "view",
  },
  viewer: {
    inventory: "view",
    sales: "view",
    analytics: "view",
    members: "none",
  },
};
