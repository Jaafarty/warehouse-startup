import type { BuiltInRole } from "./roles";

export const PAGE_KEYS = [
  "inventory",
  "sales",
  "returns",
  "analytics",
  "members",
  "settings",
  "roles",
  "exchange_rate",
] as const;

export type PageKey = (typeof PAGE_KEYS)[number];

export const PAGE_FUNCTIONS: Record<PageKey, readonly string[]> = {
  inventory: [
    "view_list",
    "add_product",
    "edit_product",
    "archive_product",
    "import_products",
    "export_products",
    "adjust_stock",
    "view_history",
    "create_category",
    "edit_category",
    "remove_category",
  ],
  sales: ["view_list", "create_sale"],
  returns: ["view_list", "process_return"],
  analytics: ["view_analytics", "export_csv"],
  members: ["view_members", "invite_member", "change_role", "remove_member"],
  settings: ["view_settings", "edit_settings"],
  roles: ["view_list", "create_role", "edit_role", "remove_role"],
  exchange_rate: ["view_list", "set_rate"],
};

export type PagePermissions = {
  enabled: boolean;
  functions: Record<string, boolean>;
};

export type StorePermissions = Record<PageKey, PagePermissions>;

export const LOCKED_FUNCTIONS: Partial<Record<PageKey, readonly string[]>> = {
  inventory: ["view_list"],
  sales: ["view_list"],
  returns: ["view_list"],
  analytics: ["view_analytics"],
  members: ["view_members"],
  settings: ["view_settings"],
  roles: ["view_list"],
  exchange_rate: ["view_list"],
};

export const FUNCTION_DEPENDENCIES: Array<{
  when: [PageKey, string];
  requires: Array<[PageKey, string]>;
}> = [
  {
    when: ["returns", "process_return"],
    requires: [
      ["sales", "view_list"],
      ["inventory", "view_list"],
    ],
  },
];

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
    roles: makePage(true, PAGE_FUNCTIONS.roles, [...PAGE_FUNCTIONS.roles]),
    exchange_rate: makePage(true, PAGE_FUNCTIONS.exchange_rate, [...PAGE_FUNCTIONS.exchange_rate]),
  },
  admin: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, [...PAGE_FUNCTIONS.inventory]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, [...PAGE_FUNCTIONS.sales]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, [...PAGE_FUNCTIONS.returns]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, [...PAGE_FUNCTIONS.analytics]),
    members: makePage(true, PAGE_FUNCTIONS.members, [...PAGE_FUNCTIONS.members]),
    settings: makePage(true, PAGE_FUNCTIONS.settings, [...PAGE_FUNCTIONS.settings]),
    roles: makePage(true, PAGE_FUNCTIONS.roles, [...PAGE_FUNCTIONS.roles]),
    exchange_rate: makePage(true, PAGE_FUNCTIONS.exchange_rate, [...PAGE_FUNCTIONS.exchange_rate]),
  },
  employee: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, [
      "view_list", "add_product", "edit_product", "adjust_stock", "view_history",
      "create_category", "edit_category", "remove_category",
    ]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, [...PAGE_FUNCTIONS.sales]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, [...PAGE_FUNCTIONS.returns]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, ["view_analytics"]),
    members: makePage(true, PAGE_FUNCTIONS.members, ["view_members"]),
    settings: makePage(false, PAGE_FUNCTIONS.settings, []),
    roles: makePage(false, PAGE_FUNCTIONS.roles, []),
    exchange_rate: makePage(true, PAGE_FUNCTIONS.exchange_rate, ["view_list"]),
  },
  viewer: {
    inventory: makePage(true, PAGE_FUNCTIONS.inventory, ["view_list", "view_history"]),
    sales: makePage(true, PAGE_FUNCTIONS.sales, ["view_list"]),
    returns: makePage(true, PAGE_FUNCTIONS.returns, ["view_list"]),
    analytics: makePage(true, PAGE_FUNCTIONS.analytics, ["view_analytics"]),
    members: makePage(false, PAGE_FUNCTIONS.members, []),
    settings: makePage(false, PAGE_FUNCTIONS.settings, []),
    roles: makePage(false, PAGE_FUNCTIONS.roles, []),
    exchange_rate: makePage(true, PAGE_FUNCTIONS.exchange_rate, ["view_list"]),
  },
};
