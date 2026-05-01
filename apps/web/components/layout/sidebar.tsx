"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Bell,
  BarChart3,
  RotateCcw,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { StorePermissions } from "@ware-house/shared";

interface SidebarProps {
  storeId: string;
  storeName: string;
  role: string;
  permissions: StorePermissions;
}

export function Sidebar({ storeId, storeName, role, permissions }: SidebarProps) {
  const pathname = usePathname();
  const base = `/store/${storeId}`;

  const links = [
    {
      href: base,
      label: "Dashboard",
      icon: LayoutDashboard,
      show: true,
    },
    {
      href: `${base}/inventory`,
      label: "Inventory",
      icon: Package,
      show: permissions.inventory?.enabled ?? false,
    },
    {
      href: `${base}/sales`,
      label: "Sales",
      icon: ShoppingCart,
      show: permissions.sales?.enabled ?? false,
    },
    {
      href: `${base}/returns`,
      label: "Returns",
      icon: RotateCcw,
      show: permissions.returns?.enabled ?? false,
    },
    {
      href: `${base}/analytics`,
      label: "Analytics",
      icon: BarChart3,
      show: permissions.analytics?.enabled ?? false,
    },
    {
      href: `${base}/members`,
      label: "Members",
      icon: Users,
      show: permissions.members?.enabled ?? false,
    },
    {
      href: `${base}/roles`,
      label: "Roles",
      icon: ShieldCheck,
      show: role === "owner" || role === "admin",
    },
    {
      href: `${base}/exchange-rate`,
      label: "Exchange Rate",
      icon: DollarSign,
      show: true,
    },
    {
      href: `${base}/settings`,
      label: "Settings",
      icon: Settings,
      show: permissions.settings?.enabled ?? false,
    },
  ];

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
        {links
          .filter((l) => l.show)
          .map((link) => {
            const isActive =
              link.href === base
                ? pathname === base
                : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn("w-full justify-start gap-2")}
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
      </nav>
    </aside>
  );
}
