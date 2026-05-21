"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import {
  LayoutDashboard,
  ChevronRight,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_KEYS, type PageKey } from "@ware-house/shared";
import { PAGE_META } from "@/components/permissions/page-meta";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import type { StorePermissions } from "@ware-house/shared";

interface SidebarProps {
  storeId: string;
  storeName: string;
  role: string;
  permissions?: StorePermissions;
}

type NavLink = {
  page: PageKey | "dashboard";
  label: string;
  icon: LucideIcon;
  href: string;
  active: boolean;
};

type Section = { id: string; label: string; pages: (PageKey | "dashboard")[] };

const SECTIONS: Section[] = [
  { id: "overview", label: "Overview", pages: ["dashboard", "analytics"] },
  {
    id: "operations",
    label: "Operations",
    pages: ["inventory", "sales", "returns", "cash", "shifts", "exchange_rate"],
  },
  { id: "workspace", label: "Workspace", pages: ["members", "roles", "settings"] },
];

const COLLAPSED_KEY = "wh-sidebar-collapsed";
const OPEN_KEY = "wh-sidebar-open";

export function Sidebar({
  storeId,
  storeName: initialName,
  role: initialRole,
  permissions: initialPermissions,
}: SidebarProps) {
  const pathname = usePathname();
  const basePath = `/store/${storeId}`;

  const { userId } = useCurrentUser();
  const liveStore = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const storeName = liveStore?.name ?? initialName;
  const role = liveStore?.role ?? initialRole;
  const permissions = liveStore?.effectivePermissions ?? initialPermissions;
  const isPrivileged = role === "owner" || role === "admin";
  const shiftsEnabled = liveStore?.shiftsEnabled ?? false;

  // Build full visible link list (existing permission filtering preserved).
  const visiblePages: NavLink[] = React.useMemo(() => {
    const dashboardLink: NavLink = {
      page: "dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      href: basePath,
      active: pathname === basePath,
    };

    const pageLinks: NavLink[] = PAGE_KEYS
      .filter(
        (p) =>
          PAGE_META[p] !== undefined &&
          (p !== "shifts" || shiftsEnabled) &&
          (isPrivileged || (permissions?.[p]?.enabled ?? false))
      )
      .map((p) => {
        const slug = p === "exchange_rate" ? "exchange-rate" : p;
        const href = `${basePath}/${slug}`;
        return {
          page: p,
          label: PAGE_META[p].label,
          icon: PAGE_META[p].icon,
          href,
          active: pathname.startsWith(href),
        };
      });

    return [dashboardLink, ...pageLinks];
  }, [basePath, pathname, isPrivileged, permissions, shiftsEnabled]);

  // Group into sections, skipping sections that end up empty.
  const sections = React.useMemo(() => {
    const byPage = new Map(visiblePages.map((l) => [l.page, l]));
    return SECTIONS.map((s) => ({
      ...s,
      links: s.pages.map((p) => byPage.get(p)).filter(Boolean) as NavLink[],
    })).filter((s) => s.links.length > 0);
  }, [visiblePages]);

  // Collapse state
  const [collapsed, setCollapsed] = React.useState(false);
  const [open, setOpen] = React.useState<Record<string, boolean>>({});

  // Hydrate from localStorage post-mount to avoid SSR mismatch.
  React.useEffect(() => {
    try {
      const c = localStorage.getItem(COLLAPSED_KEY);
      if (c) setCollapsed(c === "1");
      const o = localStorage.getItem(OPEN_KEY);
      if (o) {
        setOpen(JSON.parse(o));
        return;
      }
    } catch {}
    // Default: open the section containing the active link.
    const init: Record<string, boolean> = {};
    sections.forEach((s) => {
      init[s.id] = s.links.some((l) => l.active);
    });
    setOpen(init);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {}
  }, [collapsed]);
  React.useEffect(() => {
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(open));
    } catch {}
  }, [open]);

  // Auto-open the section containing the active link on navigation.
  React.useEffect(() => {
    const sec = sections.find((s) => s.links.some((l) => l.active));
    if (sec && !open[sec.id]) {
      setOpen((o) => ({ ...o, [sec.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function toggleSection(id: string) {
    setOpen((o) => ({ ...o, [id]: !o[id] }));
  }

  const W = collapsed ? 68 : 248;

  return (
    <aside
      className="flex h-full flex-col border-r bg-sidebar overflow-hidden relative"
      style={{
        width: W,
        flexShrink: 0,
        transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* Store header */}
      <div
        className={cn(
          "flex items-center border-b border-sidebar-border",
          collapsed ? "h-14 justify-center px-2" : "h-14 px-4"
        )}
      >
        {collapsed ? (
          <Link
            href="/dashboard"
            className="text-muted-foreground hover:text-foreground text-xs"
            title="All stores"
          >
            ←
          </Link>
        ) : (
          <div className="flex flex-col min-w-0 w-full">
            <Link
              href="/dashboard"
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              &larr; Stores
            </Link>
            <p
              className="font-semibold truncate text-[13px] text-sidebar-foreground"
              title={storeName}
            >
              {storeName}
            </p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        className={cn(
          "flex-1 overflow-y-auto overflow-x-hidden flex flex-col",
          collapsed ? "p-2 gap-2" : "p-3 gap-1.5"
        )}
      >
        {sections.map((section, sIdx) => {
          const isOpen = collapsed ? true : !!open[section.id];
          return (
            <div key={section.id}>
              {/* Section header (accordion trigger) */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1 h-7 bg-transparent rounded-md text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted hover:text-foreground transition"
                >
                  <span>{section.label}</span>
                  <ChevronRight
                    className="h-3 w-3 opacity-70 transition-transform duration-200"
                    style={{
                      transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    }}
                  />
                </button>
              )}
              {collapsed && sIdx > 0 && (
                <div className="h-px bg-border my-1.5 mx-2" />
              )}
              {/* Section links */}
              <div
                className="flex flex-col gap-0.5 overflow-hidden"
                style={{
                  maxHeight: isOpen ? 600 : 0,
                  opacity: isOpen ? 1 : 0,
                  transition: "max-height 0.22s ease, opacity 0.18s ease",
                  marginTop: isOpen && !collapsed ? 2 : 0,
                }}
              >
                {section.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      title={collapsed ? link.label : undefined}
                      className={cn(
                        "relative flex items-center select-none transition rounded-md",
                        collapsed
                          ? "h-10 justify-center"
                          : "h-9 gap-2.5 px-2.5",
                        link.active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium",
                        "text-[13px]"
                      )}
                    >
                      {link.active && !collapsed && (
                        <span
                          className="absolute left-[-12px] top-2 bottom-2 w-[3px] rounded-r"
                          style={{ background: "var(--primary)" }}
                        />
                      )}
                      <Icon
                        className={collapsed ? "h-[18px] w-[18px]" : "h-4 w-4"}
                      />
                      {!collapsed && link.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer: upgrade card + collapse toggle */}
      <div
        className={cn(
          "border-t border-sidebar-border flex flex-col gap-2.5",
          collapsed ? "p-2" : "p-3"
        )}
      >
        {!collapsed && (
          <div
            className="p-3 rounded-xl border"
            style={{
              background:
                "linear-gradient(135deg, var(--primary-soft), var(--accent-soft))",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="h-3.5 w-3.5" style={{ color: "var(--primary)" }} />
              <span
                className="text-[12px] font-semibold"
                style={{ color: "var(--primary-soft-foreground)" }}
              >
                Upgrade to Pro
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Unlimited products, advanced reports & priority support.
            </p>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center bg-transparent border-none cursor-pointer rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition text-[12px] font-medium w-full",
            collapsed ? "h-10 justify-center" : "h-9 gap-2 px-2.5"
          )}
        >
          <ChevronRight
            className="h-4 w-4 transition-transform duration-200"
            style={{ transform: collapsed ? "rotate(0deg)" : "rotate(180deg)" }}
          />
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
