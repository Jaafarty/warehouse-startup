"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  Bell,
  LogOut,
  User,
  ChevronLeft,
  Boxes,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/use-current-user";

interface TopbarProps {
  userName: string;
  userEmail: string;
}

export function Topbar({ userName, userEmail }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { signOut } = useClerk();

  const segments = pathname.split("/").filter(Boolean);
  const LIST_SECTIONS = new Set([
    "inventory",
    "categories",
    "sales",
    "returns",
    "members",
    "analytics",
    "settings",
    "shifts",
    "cash",
    "roles",
    "exchange-rate",
  ]);
  const isRoot =
    segments.length === 0 ||
    (segments.length === 1 && segments[0] === "dashboard") ||
    (segments[0] === "store" && segments.length === 2) ||
    (segments[0] === "store" && segments.length === 3 && LIST_SECTIONS.has(segments[2]));
  const showBack = !isRoot;

  const inStore = segments[0] === "store";

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

  return (
    <header
      className="flex h-[60px] items-center justify-between border-b bg-card px-6 flex-shrink-0"
    >
      {/* Left: logomark + back */}
      <div className="flex items-center gap-2">
        {showBack && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            aria-label="Back"
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
        <Link href="/dashboard" className="flex items-center gap-2.5 group">
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
          <span className="text-base font-bold text-foreground tracking-tight">
            Ware-House
          </span>
        </Link>
      </div>

      {/* Center: search (visual-only for now) — only inside store */}
      {inStore && (
      <div className="relative hidden md:block w-[360px] max-w-[40vw]">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground"
        />
        <input
          placeholder="Search products, sales, members…"
          className="w-full h-9 rounded-lg border bg-background-subtle pl-9 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground outline-none focus-visible:border-primary"
          aria-label="Global search"
        />
        <span
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-card px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
        >
          ⌘K
        </span>
      </div>
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
              <span
                className="absolute right-2 top-2 h-2 min-w-2 rounded-full bg-destructive ring-2 ring-card"
              />
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
              <span className="text-[10px] text-muted-foreground">Owner</span>
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
