"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Check, ChevronsUpDown, Store as StoreIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StoreSwitcherProps {
  storeId: string;
  storeName: string;
  role: string;
  collapsed?: boolean;
}

export function StoreSwitcher({
  storeId,
  storeName,
  role,
  collapsed,
}: StoreSwitcherProps) {
  const { userId } = useCurrentUser();
  const stores = useQuery(
    api.stores.listByUser,
    userId ? { userId } : "skip"
  );

  const initial = storeName.slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title={collapsed ? `${storeName} — switch store` : "Switch store"}
        className={cn(
          "flex items-center rounded-lg hover:bg-white/40 transition w-full",
          collapsed ? "h-10 justify-center" : "gap-2.5 px-1.5 py-1"
        )}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg text-white flex-shrink-0"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
            boxShadow: "0 2px 8px oklch(0.58 0.13 195 / 0.35)",
          }}
        >
          <span className="text-[12px] font-bold">{initial}</span>
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left leading-tight">
              <p
                className="font-semibold truncate text-[13px] text-sidebar-foreground"
                title={storeName}
              >
                {storeName}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {role}
              </p>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Your stores
        </div>
        {stores === undefined && (
          <div className="px-2 py-2 text-xs text-muted-foreground">
            Loading...
          </div>
        )}
        {stores?.map((s) => {
          const isCurrent = s._id === storeId;
          return (
            <DropdownMenuItem
              key={s._id}
              render={
                <Link href={`/store/${s._id}`} className="cursor-pointer" />
              }
            >
              <div
                className="flex h-6 w-6 items-center justify-center rounded-md text-white flex-shrink-0 mr-2"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
                }}
              >
                <span className="text-[10px] font-bold">
                  {s.name.slice(0, 1).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium truncate">{s.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">
                  {s.role}
                </p>
              </div>
              {isCurrent && (
                <Check className="h-3.5 w-3.5 text-primary flex-shrink-0 ml-2" />
              )}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          render={<Link href="/dashboard" className="cursor-pointer" />}
        >
          <StoreIcon className="h-4 w-4 mr-2" />
          See all stores
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
