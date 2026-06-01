"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { Command as CommandPrimitive } from "cmdk";
import {
  Search,
  CornerDownLeft,
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
import { cn } from "@/lib/utils";
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

// An action gated by a specific function permission (page + fn).
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
}

export function CommandPalette({ storeId }: CommandPaletteProps) {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const liveStore = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip",
  );

  const role = liveStore?.role;
  const permissions = liveStore?.effectivePermissions as
    | StorePermissions
    | undefined;
  const isPrivileged = role === "owner" || role === "admin";

  // Actions gate strictly on the explicit function flag — matches backend
  // `assertPageFunction`. Owner/admin already hold every function.
  const actions = React.useMemo(
    () =>
      ACTIONS.filter((a) => permissions?.[a.page]?.functions?.[a.fn] === true),
    [permissions],
  );

  // Navigation gates on page.enabled; privileged roles bypass defensively.
  const navPages = React.useMemo(
    () =>
      PAGE_KEYS.filter(
        (p) =>
          PAGE_META[p] !== undefined &&
          (isPrivileged || (permissions?.[p]?.enabled ?? false)),
      ),
    [isPrivileged, permissions],
  );

  // ⌘K / Ctrl+K focuses the inline input (no modal).
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Close when clicking outside.
  React.useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  function run(href: string) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative hidden md:block w-[380px] max-w-[42vw]"
    >
      <CommandPrimitive
        loop
        className="overflow-visible"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
      >
        {/* Inline input — stays in the topbar, never a modal */}
        <div
          className={cn(
            "group relative flex h-9 items-center rounded-lg border bg-background-subtle transition-colors",
            open
              ? "border-primary ring-2 ring-primary/15"
              : "hover:border-foreground/20",
          )}
        >
          <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={query}
            onValueChange={setQuery}
            onFocus={() => setOpen(true)}
            placeholder="Search actions…"
            className="h-full w-full bg-transparent pl-9 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus-visible:shadow-none"
          />
          <kbd
            className={cn(
              "pointer-events-none absolute right-2 rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground transition-opacity",
              open ? "opacity-0" : "opacity-100",
            )}
          >
            ⌘K
          </kbd>
        </div>

        {/* Suggestion dropdown — anchored, not modal */}
        {open && (
          <CommandPrimitive.List
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 max-h-[min(60vh,420px)] overflow-y-auto overflow-x-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-xl shadow-black/5 ring-1 ring-black/[0.02] animate-in fade-in-0 zoom-in-[0.98] slide-in-from-top-1 duration-150"
          >
            <CommandPrimitive.Empty className="px-3 py-8 text-center text-[13px] text-muted-foreground">
              No matches for “{query}”.
            </CommandPrimitive.Empty>

            {actions.length > 0 && (
              <Group heading="Actions">
                {actions.map((a) => (
                  <Item
                    key={a.label}
                    value={a.label}
                    keywords={a.keywords}
                    icon={a.icon}
                    label={a.label}
                    kind="action"
                    onSelect={() => run(a.to(storeId))}
                  />
                ))}
              </Group>
            )}

            {navPages.length > 0 && (
              <Group heading="Go to">
                {navPages.map((p) => (
                  <Item
                    key={p}
                    value={`go ${PAGE_META[p].label}`}
                    keywords={["open", "view", "navigate", PAGE_META[p].label]}
                    icon={PAGE_META[p].icon}
                    label={PAGE_META[p].label}
                    kind="nav"
                    onSelect={() => run(`/store/${storeId}/${slugFor(p)}`)}
                  />
                ))}
              </Group>
            )}
          </CommandPrimitive.List>
        )}
      </CommandPrimitive>
    </div>
  );
}

function Group({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <CommandPrimitive.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
    >
      {children}
    </CommandPrimitive.Group>
  );
}

function Item({
  value,
  keywords,
  icon: Icon,
  label,
  kind,
  onSelect,
}: {
  value: string;
  keywords?: string[];
  icon: LucideIcon;
  label: string;
  kind: "action" | "nav";
  onSelect: () => void;
}) {
  return (
    <CommandPrimitive.Item
      value={value}
      keywords={keywords}
      onSelect={onSelect}
      className="group/item relative flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 text-[13px] text-foreground outline-none data-[selected=true]:bg-muted"
    >
      {/* active accent bar */}
      <span className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-primary opacity-0 group-data-[selected=true]/item:opacity-100" />
      <span
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors",
          kind === "action"
            ? "border-primary/20 bg-primary/10 text-primary"
            : "border-border bg-muted/60 text-muted-foreground group-data-[selected=true]/item:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 truncate font-medium">{label}</span>
      <span className="flex items-center gap-1 opacity-0 transition-opacity group-data-[selected=true]/item:opacity-100">
        {kind === "action" && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary">
            Action
          </span>
        )}
        <CornerDownLeft className="h-3 w-3 text-muted-foreground" />
      </span>
    </CommandPrimitive.Item>
  );
}
