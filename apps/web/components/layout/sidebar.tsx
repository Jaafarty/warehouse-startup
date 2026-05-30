"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
    LayoutDashboard,
    ChevronRight,
    LogOut,
    Settings,
    Bell,
    PanelLeftClose,
    PanelLeftOpen,
    type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PAGE_KEYS, type PageKey } from "@ware-house/shared";
import { PAGE_META } from "@/components/permissions/page-meta";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import type { StorePermissions } from "@ware-house/shared";
import { StoreSwitcher } from "@/components/layout/store-switcher";
import { useMobileNav } from "@/components/layout/mobile-nav-context";

interface SidebarProps {
    storeId: string;
    storeName: string;
    role: string;
    permissions?: StorePermissions;
    userName: string;
    userEmail: string;
}

type NavLink = {
    page: PageKey | "dashboard";
    label: string;
    icon: LucideIcon;
    href: string;
    active: boolean;
};

type Section = { id: string; label: string; pages: (PageKey | "dashboard")[] };
type ResolvedSection = Section & { links: NavLink[] };

const SECTIONS: Section[] = [
    { id: "overview", label: "Overview", pages: ["dashboard", "analytics"] },
    {
        id: "operations",
        label: "Operations",
        pages: [
            "inventory",
            "categories",
            "sales",
            "returns",
            "cash",
            "registers",
            "shifts",
            "exchange_rate",
        ],
    },
    {
        id: "workspace",
        label: "Workspace",
        pages: ["members", "roles", "settings"],
    },
];

const COLLAPSED_KEY = "wh-sidebar-collapsed";
const OPEN_KEY = "wh-sidebar-open";

const STORE_HEADER_BG =
    "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)";

// ── Shared nav list (used by desktop aside + mobile sheet) ──────────────
function NavSections({
    sections,
    collapsed,
    open,
    toggleSection,
    onNavigate,
}: {
    sections: ResolvedSection[];
    collapsed: boolean;
    open: Record<string, boolean>;
    toggleSection: (id: string) => void;
    onNavigate?: () => void;
}) {
    return (
        <nav
            className={cn(
                "flex-1 overflow-y-auto overflow-x-hidden flex flex-col",
                collapsed ? "p-2 gap-2" : "p-3 gap-1.5",
            )}
        >
            {sections.map((section, sIdx) => {
                const isOpen = collapsed ? true : !!open[section.id];
                return (
                    <div key={section.id}>
                        {!collapsed && (
                            <button
                                onClick={() => toggleSection(section.id)}
                                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1 h-7 bg-transparent rounded-md text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground hover:bg-muted hover:text-foreground transition"
                            >
                                <span>{section.label}</span>
                                <ChevronRight
                                    className="h-3 w-3 opacity-70 transition-transform duration-200"
                                    style={{
                                        transform: isOpen
                                            ? "rotate(90deg)"
                                            : "rotate(0deg)",
                                    }}
                                />
                            </button>
                        )}
                        {collapsed && sIdx > 0 && (
                            <div className="h-px bg-border my-1.5 mx-2" />
                        )}
                        <div
                            className="flex flex-col gap-0.5 overflow-hidden"
                            style={{
                                maxHeight: isOpen ? 600 : 0,
                                opacity: isOpen ? 1 : 0,
                                transition:
                                    "max-height 0.22s ease, opacity 0.18s ease",
                                marginTop: isOpen && !collapsed ? 2 : 0,
                            }}
                        >
                            {section.links.map((link) => {
                                const Icon = link.icon;
                                return (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={onNavigate}
                                        title={
                                            collapsed ? link.label : undefined
                                        }
                                        className={cn(
                                            "relative flex items-center select-none transition rounded-md",
                                            collapsed
                                                ? "h-10 justify-center"
                                                : "h-9 gap-2.5 px-2.5",
                                            link.active
                                                ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground font-medium",
                                            "text-[13px]",
                                        )}
                                    >
                                        {link.active && !collapsed && (
                                            <span
                                                className="absolute left-[-12px] top-2 bottom-2 w-[3px] rounded-r"
                                                style={{
                                                    background: "var(--primary)",
                                                }}
                                            />
                                        )}
                                        <Icon
                                            className={
                                                collapsed
                                                    ? "h-[18px] w-[18px]"
                                                    : "h-4 w-4"
                                            }
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
    );
}

// ── Shared footer (profile menu + optional collapse toggle) ─────────────
function SidebarFooter({
    collapsed,
    initials,
    userName,
    userEmail,
    role,
    onProfileNavigate,
    onToggleCollapse,
}: {
    collapsed: boolean;
    initials: string;
    userName: string;
    userEmail: string;
    role: string;
    onProfileNavigate: (href: string) => void;
    onToggleCollapse?: () => void;
}) {
    const { signOut } = useClerk();
    return (
        <div
            className={cn(
                "border-t border-sidebar-border flex flex-col gap-2.5",
                collapsed ? "p-2" : "p-3",
            )}
        >
            <div
                className={cn(
                    "flex items-center w-full",
                    collapsed ? "flex-col gap-1" : "gap-1",
                )}
            >
                <DropdownMenu>
                    <DropdownMenuTrigger
                        title={collapsed ? userName : undefined}
                        className={cn(
                            "flex items-center rounded-lg hover:bg-muted transition",
                            collapsed
                                ? "h-10 w-10 justify-center"
                                : "flex-1 min-w-0 gap-2.5 px-1.5 py-1.5",
                        )}
                    >
                        <div
                            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white flex-shrink-0"
                            style={{
                                background:
                                    "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
                            }}
                        >
                            {initials}
                        </div>
                        {!collapsed && (
                            <div className="min-w-0 flex-1 text-left leading-tight">
                                <p className="text-[12px] font-semibold text-sidebar-foreground truncate">
                                    {userName}
                                </p>
                                <p className="text-[10px] text-muted-foreground capitalize truncate">
                                    {role}
                                </p>
                            </div>
                        )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" side="top" className="w-56">
                        <div className="px-2 py-1.5">
                            <p className="text-sm font-medium truncate">
                                {userName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {userEmail}
                            </p>
                        </div>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => onProfileNavigate("/notifications")}
                        >
                            <Bell className="h-4 w-4 mr-2" />
                            Notifications
                        </DropdownMenuItem>
                        <DropdownMenuItem
                            onClick={() => onProfileNavigate("/settings")}
                        >
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={() => signOut({ redirectUrl: "/" })}
                            variant="destructive"
                        >
                            <LogOut className="h-4 w-4 mr-2" />
                            Sign Out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {onToggleCollapse && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-label={
                            collapsed ? "Expand sidebar" : "Collapse sidebar"
                        }
                        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition bg-transparent border-none cursor-pointer"
                    >
                        {collapsed ? (
                            <PanelLeftOpen className="h-4 w-4" />
                        ) : (
                            <PanelLeftClose className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>
        </div>
    );
}

// Gradient + stripes header strip shared by desktop + mobile.
function StoreHeader({
    storeId,
    storeName,
    role,
    collapsed,
}: {
    storeId: string;
    storeName: string;
    role: string;
    collapsed: boolean;
}) {
    return (
        <div
            className={cn(
                "relative overflow-hidden flex items-center border-b border-sidebar-border",
                collapsed ? "h-14 justify-center px-2" : "h-14 px-3",
            )}
            style={{ background: STORE_HEADER_BG }}
        >
            <div
                aria-hidden
                className="wh-pattern-stripes absolute inset-0 pointer-events-none"
                style={{
                    maskImage:
                        "linear-gradient(to bottom right, rgba(0,0,0,0.55), rgba(0,0,0,0))",
                    WebkitMaskImage:
                        "linear-gradient(to bottom right, rgba(0,0,0,0.55), rgba(0,0,0,0))",
                }}
            />
            <div className="relative w-full">
                <StoreSwitcher
                    storeId={storeId}
                    storeName={storeName}
                    role={role}
                    collapsed={collapsed}
                />
            </div>
        </div>
    );
}

export function Sidebar({
    storeId,
    storeName: initialName,
    role: initialRole,
    permissions: initialPermissions,
    userName,
    userEmail,
}: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const basePath = `/store/${storeId}`;
    const mobileNav = useMobileNav();

    const initials = userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    const { userId } = useCurrentUser();
    const liveStore = useQuery(
        api.stores.getById,
        userId ? { storeId: storeId as Id<"stores">, userId } : "skip",
    );

    const storeName = liveStore?.name ?? initialName;
    const role = liveStore?.role ?? initialRole;
    const permissions = liveStore?.effectivePermissions ?? initialPermissions;
    const isPrivileged = role === "owner" || role === "admin";

    // Build full visible link list (existing permission filtering preserved).
    const visiblePages: NavLink[] = React.useMemo(() => {
        const dashboardLink: NavLink = {
            page: "dashboard",
            label: "Dashboard",
            icon: LayoutDashboard,
            href: basePath,
            active: pathname === basePath,
        };

        const pageLinks: NavLink[] = PAGE_KEYS.filter(
            (p) =>
                PAGE_META[p] !== undefined &&
                (isPrivileged || (permissions?.[p]?.enabled ?? false)),
        ).map((p) => {
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
    }, [basePath, pathname, isPrivileged, permissions]);

    // Group into sections, skipping sections that end up empty.
    const sections = React.useMemo(() => {
        const byPage = new Map(visiblePages.map((l) => [l.page, l]));
        return SECTIONS.map((s) => ({
            ...s,
            links: s.pages
                .map((p) => byPage.get(p))
                .filter(Boolean) as NavLink[],
        })).filter((s) => s.links.length > 0);
    }, [visiblePages]);

    // Collapse state (desktop only)
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
        <>
            {/* Desktop sidebar */}
            <aside
                className="hidden md:flex h-full flex-col border-r bg-sidebar overflow-hidden relative"
                style={{
                    width: W,
                    flexShrink: 0,
                    transition: "width 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            >
                <StoreHeader
                    storeId={storeId}
                    storeName={storeName}
                    role={role}
                    collapsed={collapsed}
                />
                <NavSections
                    sections={sections}
                    collapsed={collapsed}
                    open={open}
                    toggleSection={toggleSection}
                />
                <SidebarFooter
                    collapsed={collapsed}
                    initials={initials}
                    userName={userName}
                    userEmail={userEmail}
                    role={role}
                    onProfileNavigate={(href) => router.push(href)}
                    onToggleCollapse={() => setCollapsed((c) => !c)}
                />
            </aside>

            {/* Mobile drawer */}
            <Sheet open={mobileNav.open} onOpenChange={mobileNav.setOpen}>
                <SheetContent
                    side="left"
                    showCloseButton={false}
                    className="w-[270px] max-w-[85vw] p-0 gap-0 bg-sidebar flex flex-col md:hidden"
                >
                    <SheetTitle className="sr-only">
                        Store navigation
                    </SheetTitle>
                    <StoreHeader
                        storeId={storeId}
                        storeName={storeName}
                        role={role}
                        collapsed={false}
                    />
                    <NavSections
                        sections={sections}
                        collapsed={false}
                        open={open}
                        toggleSection={toggleSection}
                        onNavigate={() => mobileNav.setOpen(false)}
                    />
                    <SidebarFooter
                        collapsed={false}
                        initials={initials}
                        userName={userName}
                        userEmail={userEmail}
                        role={role}
                        onProfileNavigate={(href) => {
                            mobileNav.setOpen(false);
                            router.push(href);
                        }}
                    />
                </SheetContent>
            </Sheet>
        </>
    );
}
