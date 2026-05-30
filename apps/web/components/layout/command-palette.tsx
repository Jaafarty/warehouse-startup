"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import {
  Plus,
  ArrowRight,
  Package,
  Tag,
  ShoppingCart,
  RotateCcw,
  UserPlus,
  Shield,
  DollarSign,
  Clock,
  Wallet,
  CreditCard,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import {
  PAGE_KEYS,
  type PageKey,
  type StorePermissions,
} from "@ware-house/shared";
import { PAGE_META } from "@/components/permissions/page-meta";

// Route slug differs from page key only for exchange_rate.
function slugFor(page: PageKey): string {
  return page === "exchange_rate" ? "exchange-rate" : page;
}

// An action gated by a specific function permission (page + fn). These are the
// "do something" entries — Add product, New sale, etc.
type ActionCmd = {
  label: string;
  icon: LucideIcon;
  page: PageKey;
  fn: string;
  to: (storeId: string) => string;
  keywords?: string[];
};

const ACTIONS: ActionCmd[] = [
  {
    label: "Add product",
    icon: Package,
    page: "inventory",
    fn: "add_product",
    to: (s) => `/store/${s}/inventory/new`,
    keywords: ["new", "create", "item", "stock"],
  },
  {
    label: "Add category",
    icon: Tag,
    page: "categories",
    fn: "create_category",
    to: (s) => `/store/${s}/categories`,
    keywords: ["new", "create"],
  },
  {
    label: "New sale",
    icon: ShoppingCart,
    page: "sales",
    fn: "create_sale",
    to: (s) => `/store/${s}/sales/new`,
    keywords: ["add", "create", "sell", "checkout", "order"],
  },
  {
    label: "Process return",
    icon: RotateCcw,
    page: "returns",
    fn: "process_return",
    to: (s) => `/store/${s}/returns`,
    keywords: ["add", "refund", "new"],
  },
  {
    label: "Open shift",
    icon: Clock,
    page: "shifts",
    fn: "open_shift",
    to: (s) => `/store/${s}/shifts`,
    keywords: ["start", "cashier", "drawer"],
  },
  {
    label: "Record cash in",
    icon: Wallet,
    page: "cash",
    fn: "record_in",
    to: (s) => `/store/${s}/cash`,
    keywords: ["add", "paid-in", "drawer", "money"],
  },
  {
    label: "Record cash out",
    icon: Wallet,
    page: "cash",
    fn: "record_out",
    to: (s) => `/store/${s}/cash`,
    keywords: ["add", "paid-out", "drawer", "money"],
  },
  {
    label: "Add register",
    icon: CreditCard,
    page: "registers",
    fn: "create_register",
    to: (s) => `/store/${s}/registers`,
    keywords: ["new", "create", "till"],
  },
  {
    label: "Invite member",
    icon: UserPlus,
    page: "members",
    fn: "invite_member",
    to: (s) => `/store/${s}/members`,
    keywords: ["add", "team", "user", "staff"],
  },
  {
    label: "Add role",
    icon: Shield,
    page: "roles",
    fn: "create_role",
    to: (s) => `/store/${s}/roles`,
    keywords: ["new", "create", "permission"],
  },
  {
    label: "Set exchange rate",
    icon: DollarSign,
    page: "exchange_rate",
    fn: "set_rate",
    to: (s) => `/store/${s}/exchange-rate`,
    keywords: ["update", "usd", "lbp", "currency"],
  },
];

interface CommandPaletteProps {
  storeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({
  storeId,
  open,
  onOpenChange,
}: CommandPaletteProps) {
  const router = useRouter();
  const { userId } = useCurrentUser();

  const liveStore = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip",
  );

  const role = liveStore?.role;
  const permissions = liveStore?.effectivePermissions as
    | StorePermissions
    | undefined;
  const isPrivileged = role === "owner" || role === "admin";

  // Actions gate strictly on the explicit function flag — matches the backend
  // `assertPageFunction`. Owner/admin already have every function in
  // DEFAULT_PERMISSIONS, so no bypass needed here.
  const actions = React.useMemo(
    () =>
      ACTIONS.filter((a) => permissions?.[a.page]?.functions?.[a.fn] === true),
    [permissions],
  );

  // Navigation gates on page.enabled; privileged roles bypass defensively
  // (mirrors the sidebar) for the deploy-transition window.
  const navPages = React.useMemo(
    () =>
      PAGE_KEYS.filter(
        (p) =>
          PAGE_META[p] !== undefined &&
          (isPrivileged || (permissions?.[p]?.enabled ?? false)),
      ),
    [isPrivileged, permissions],
  );

  function run(href: string) {
    onOpenChange(false);
    router.push(href);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Command palette"
      description="Search actions and pages"
    >
      <Command>
        <CommandInput placeholder="Type a command or search… (e.g. add product)" />
        <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {actions.length > 0 && (
          <CommandGroup heading="Actions">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <CommandItem
                  key={a.label}
                  value={a.label}
                  keywords={a.keywords}
                  onSelect={() => run(a.to(storeId))}
                >
                  <Icon className="h-4 w-4" />
                  <span>{a.label}</span>
                  <Plus className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {navPages.length > 0 && (
          <CommandGroup heading="Go to">
            {navPages.map((p) => {
              const Icon = PAGE_META[p].icon;
              return (
                <CommandItem
                  key={p}
                  value={`go ${PAGE_META[p].label}`}
                  keywords={["open", "view", "navigate", PAGE_META[p].label]}
                  onSelect={() => run(`/store/${storeId}/${slugFor(p)}`)}
                >
                  <Icon className="h-4 w-4" />
                  <span>{PAGE_META[p].label}</span>
                  <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
