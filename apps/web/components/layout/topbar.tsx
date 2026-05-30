"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bell,
  LogOut,
  User,
  Boxes,
  Search,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PAGE_KEYS, type PageKey } from "@ware-house/shared";
import { PAGE_META } from "@/components/permissions/page-meta";
import { useCurrentUser } from "@/lib/use-current-user";
import { CommandPalette } from "@/components/layout/command-palette";

interface TopbarProps {
  userName: string;
  userEmail: string;
}

// Section slug → human label (route slug differs from page key only for
// exchange_rate → exchange-rate).
const SLUG_TO_LABEL: Record<string, string> = Object.fromEntries(
  PAGE_KEYS.map((k: PageKey) => [
    k === "exchange_rate" ? "exchange-rate" : k,
    PAGE_META[k]?.label ?? k,
  ])
);

// Trailing route segments that aren't entity ids get a friendly label;
// anything else (an id) is the entity itself.
const LEAF_LABELS: Record<string, string> = {
  new: "New",
  history: "History",
  return: "Return",
  edit: "Edit",
};

type Crumb = { label: string; href?: string };

function buildCrumbs(segments: string[]): Crumb[] {
  // segments: ["store", storeId, section?, ...rest]
  if (segments[0] !== "store") return [];
  const storeId = segments[1];
  if (segments.length < 3) {
    return [{ label: "Overview" }];
  }
  const section = segments[2];
  const sectionLabel = SLUG_TO_LABEL[section] ?? section;
  const rest = segments.slice(3);
  const crumbs: Crumb[] = [
    {
      label: sectionLabel,
      // Link to the section list only when we're deeper than it.
      href: rest.length ? `/store/${storeId}/${section}` : undefined,
    },
  ];
  rest.forEach((seg) => {
    crumbs.push({ label: LEAF_LABELS[seg] ?? "Details" });
  });
  return crumbs;
}

export function Topbar({ userName, userEmail }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useClerk();

  const segments = pathname.split("/").filter(Boolean);
  const inStore = segments[0] === "store";
  const storeId = inStore ? segments[1] : undefined;
  const crumbs = inStore ? buildCrumbs(segments) : [];

  // Command palette open state + ⌘K / Ctrl+K toggle.
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  React.useEffect(() => {
    if (!inStore) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inStore]);

  const { userId } = useCurrentUser();
  const unreadCount = useQuery(
    api.notifications.unreadCount,
    userId ? { userId } : "skip"
  );

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const canGoBack = pathname !== "/dashboard" && pathname !== "/";

  return (
    <header className="flex h-[60px] items-center justify-between border-b bg-card px-6 flex-shrink-0">
      {/* Left: back + logomark + breadcrumb (in store) */}
      <div className="flex items-center gap-3 min-w-0">
        {canGoBack && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Go back"
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            <ChevronLeft className="h-[18px] w-[18px]" />
          </Button>
        )}
        <Link href="/dashboard" className="flex items-center gap-2.5 group flex-shrink-0">
          <div
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg text-white"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
              boxShadow: "0 2px 8px oklch(0.58 0.13 195 / 0.35)",
            }}
          >
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-base font-bold text-foreground tracking-tight hidden sm:inline">
            Ware-House
          </span>
        </Link>

        {crumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 min-w-0 border-l pl-3 text-[13px]"
          >
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <div key={i} className="flex items-center gap-1.5 min-w-0">
                  {i > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  {c.href && !isLast ? (
                    <Link
                      href={c.href}
                      className="text-muted-foreground hover:text-foreground transition truncate"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span
                      className={
                        isLast
                          ? "font-medium text-foreground truncate"
                          : "text-muted-foreground truncate"
                      }
                    >
                      {c.label}
                    </span>
                  )}
                </div>
              );
            })}
          </nav>
        )}
      </div>

      {/* Center: command palette trigger — only inside store */}
      {inStore && storeId && (
        <>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            aria-label="Open command palette"
            className="relative hidden md:flex items-center w-[360px] max-w-[40vw] h-9 rounded-lg border bg-background-subtle pl-9 pr-12 text-[13px] text-muted-foreground outline-none hover:border-primary transition cursor-pointer"
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">Search actions…</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
              ⌘K
            </span>
          </button>
          <CommandPalette
            storeId={storeId}
            open={paletteOpen}
            onOpenChange={setPaletteOpen}
          />
        </>
      )}

      {/* Right: notifications + profile */}
      <div className="flex items-center gap-1">
        <Link href="/notifications">
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label="Notifications"
          >
            <Bell className="h-[17px] w-[17px]" />
            {unreadCount != null && unreadCount > 0 && (
              <span className="absolute right-2 top-2 h-2 min-w-2 rounded-full bg-destructive ring-2 ring-card" />
            )}
          </Button>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg p-1 pr-2.5 hover:bg-muted transition">
              <div
                className="flex h-[30px] w-[30px] items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
                }}
              >
                {initials}
              </div>
              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-[12px] font-semibold text-foreground">
                  {userName}
                </span>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{userName}</p>
                <p className="text-xs text-muted-foreground">{userEmail}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <User className="h-4 w-4 mr-2" />
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
      </div>
    </header>
  );
}
