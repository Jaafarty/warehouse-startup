import type { BuiltInRole } from "./roles";

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
