import {
  Package,
  Tag,
  ShoppingCart,
  RotateCcw,
  BarChart3,
  Clock,
  Wallet,
  Users,
  Settings,
  Shield,
  DollarSign,
  type LucideIcon,
} from "lucide-react";
import type { PageKey } from "@ware-house/shared";

export const PAGE_META: Record<
  PageKey,
  { label: string; description: string; icon: LucideIcon }
> = {
  inventory: {
    label: "Inventory",
    description: "Products and stock",
    icon: Package,
  },
  categories: {
    label: "Categories",
    description: "Product category management",
    icon: Tag,
  },
  sales: {
    label: "Sales",
    description: "Create and view sales",
    icon: ShoppingCart,
  },
  returns: {
    label: "Returns",
    description: "Process and view returns",
    icon: RotateCcw,
  },
  analytics: {
    label: "Analytics",
    description: "Revenue charts and insights",
    icon: BarChart3,
  },
  shifts: {
    label: "Shifts",
    description: "Cashier sessions and drawer reconciliation",
    icon: Clock,
  },
  cash: {
    label: "Cash",
    description: "Drawer paid-in / paid-out events",
    icon: Wallet,
  },
  members: {
    label: "Members",
    description: "Team member management",
    icon: Users,
  },
  settings: {
    label: "Settings",
    description: "Store configuration",
    icon: Settings,
  },
  roles: {
    label: "Roles",
    description: "Custom role management",
    icon: Shield,
  },
  exchange_rate: {
    label: "Exchange Rate",
    description: "USD/LBP exchange rate",
    icon: DollarSign,
  },
};

export const FUNCTION_LABELS: Record<string, string> = {
  view_list: "View list",
add_product: "Add product",
  edit_product: "Edit product",
  archive_product: "Archive product",
  import_products: "Import products",
  export_products: "Export products",
  adjust_stock: "Adjust stock",
  view_history: "View history",
  create_category: "Create category",
  edit_category: "Edit category",
  remove_category: "Remove category",
  create_sale: "Create sale",
  process_return: "Process return",
  view_analytics: "View analytics",
  export_csv: "Export CSV",
  view_members: "View members",
  invite_member: "Invite member",
  change_role: "Change role",
  remove_member: "Remove member",
  view_settings: "View settings",
  edit_settings: "Edit settings",
  create_role: "Create role",
  edit_role: "Edit role",
  remove_role: "Remove role",
  set_rate: "Set exchange rate",
  view_own: "View own shifts",
  view_all: "View all shifts",
  open_shift: "Open shift",
  close_shift: "Close shift",
  reopen_shift: "Reopen closed shift",
  record_in: "Record paid-in",
  record_out: "Record paid-out",
};
