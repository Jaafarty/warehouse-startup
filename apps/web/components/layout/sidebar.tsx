"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PAGE_KEYS } from "@ware-house/shared";
import { PAGE_META } from "@/components/permissions/page-meta";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import type { StorePermissions } from "@ware-house/shared";

interface SidebarProps {
  storeId: string;
  // SSR fallbacks so the first paint doesn't flicker. Live values come from
  // the Convex subscription below and override these once received.
  storeName: string;
  role: string;
  permissions?: StorePermissions;
}

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

  // Reactive overrides — fall back to SSR values during the initial paint.
  const storeName = liveStore?.name ?? initialName;
  const role = liveStore?.role ?? initialRole;
  const permissions = liveStore?.effectivePermissions ?? initialPermissions;
  const isPrivileged = role === "owner" || role === "admin";

  const pageLinks = PAGE_KEYS
    .filter(
      (page) =>
        // Defensive: PAGE_META is updated on each release. Skip pages we don't
        // know how to render rather than crash.
        PAGE_META[page] !== undefined &&
        (isPrivileged || (permissions?.[page]?.enabled ?? false))
    )
    .map((page) => {
      const slug = page === "exchange_rate" ? "exchange-rate" : page;
      const href = `${basePath}/${slug}`;
      return {
        page,
        label: PAGE_META[page].label,
        icon: PAGE_META[page].icon,
        href,
        active: pathname.startsWith(href),
      };
    });

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
          &larr; Stores
        </Link>
      </div>
      <div className="px-4 py-3 border-b">
        <p className="font-semibold truncate">{storeName}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {/* Dashboard — always visible, not in PAGE_KEYS */}
        <Link href={basePath}>
          <Button
            variant={pathname === basePath ? "secondary" : "ghost"}
            className={cn("w-full justify-start gap-2")}
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Button>
        </Link>

        {pageLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Button
              variant={link.active ? "secondary" : "ghost"}
              className={cn("w-full justify-start gap-2")}
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Button>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
