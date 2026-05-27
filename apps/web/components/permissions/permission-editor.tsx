"use client";

import * as React from "react";
import {
  PAGE_KEYS,
  PAGE_FUNCTIONS,
  LOCKED_FUNCTIONS,
  FUNCTION_DEPENDENCIES,
  type PageKey,
  type StorePermissions,
} from "@ware-house/shared";
import { PAGE_META, FUNCTION_LABELS } from "./page-meta";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";

interface PermissionEditorProps {
  permissions: StorePermissions;
  onChange: (p: StorePermissions) => void;
}

// Per-page accent tints so the access list reads as a colorful map of the app
// rather than a wall of grey. Hues stay clear of purple/violet per brand rules.
const PAGE_TINT: Record<string, { fg: string; bg: string }> = {
  inventory: { fg: "oklch(0.55 0.17 255)", bg: "oklch(0.96 0.04 255)" },
  categories: { fg: "oklch(0.60 0.15 75)", bg: "oklch(0.96 0.06 80)" },
  sales: { fg: "oklch(0.57 0.15 160)", bg: "oklch(0.95 0.05 160)" },
  returns: { fg: "oklch(0.60 0.20 25)", bg: "oklch(0.96 0.04 27)" },
  analytics: { fg: "oklch(0.56 0.16 235)", bg: "oklch(0.96 0.04 235)" },
  shifts: { fg: "oklch(0.56 0.13 200)", bg: "oklch(0.96 0.04 200)" },
  cash: { fg: "oklch(0.55 0.13 185)", bg: "oklch(0.95 0.05 185)" },
  registers: { fg: "oklch(0.60 0.16 50)", bg: "oklch(0.96 0.05 55)" },
  members: { fg: "oklch(0.56 0.15 140)", bg: "oklch(0.95 0.05 140)" },
  settings: { fg: "oklch(0.58 0.17 350)", bg: "oklch(0.96 0.04 350)" },
  roles: { fg: "oklch(0.58 0.20 15)", bg: "oklch(0.96 0.04 18)" },
  exchange_rate: { fg: "oklch(0.58 0.15 110)", bg: "oklch(0.95 0.06 115)" },
};
const DEFAULT_TINT = { fg: "var(--muted-foreground)", bg: "var(--muted)" };

type ConfirmState = {
  open: boolean;
  dep: (typeof FUNCTION_DEPENDENCIES)[number] | null;
  pendingPerms: StorePermissions | null;
};

const CLOSED_CONFIRM: ConfirmState = { open: false, dep: null, pendingPerms: null };

export function PermissionEditor({ permissions, onChange }: PermissionEditorProps) {
  const [confirmState, setConfirmState] = React.useState<ConfirmState>(CLOSED_CONFIRM);

  // ── Page toggle ──────────────────────────────────────────────────────────
  function handlePageToggle(page: PageKey, enabled: boolean) {
    const locked = LOCKED_FUNCTIONS[page] ?? [];
    const fns = PAGE_FUNCTIONS[page];
    const updatedFunctions: Record<string, boolean> = {};

    for (const fn of fns) {
      if (!enabled) {
        // Disabling: all functions reset to false
        updatedFunctions[fn] = false;
      } else {
        // Enabling: locked functions forced true, others keep current value
        updatedFunctions[fn] = locked.includes(fn)
          ? true
          : (permissions[page].functions[fn] ?? false);
      }
    }

    onChange({
      ...permissions,
      [page]: { enabled, functions: updatedFunctions },
    });
  }

  // ── Function toggle ───────────────────────────────────────────────────────
  function handleFunctionToggle(page: PageKey, fn: string, checked: boolean) {
    // Build next permissions with this single change applied
    const nextPerms: StorePermissions = {
      ...permissions,
      [page]: {
        ...permissions[page],
        functions: {
          ...permissions[page].functions,
          [fn]: checked,
        },
      },
    };

    if (!checked) {
      // Toggling off — no dep check needed
      onChange(nextPerms);
      return;
    }

    // Check if this toggle is a dependency trigger
    const dep = FUNCTION_DEPENDENCIES.find(
      (d) => d.when[0] === page && d.when[1] === fn
    );

    if (!dep) {
      onChange(nextPerms);
      return;
    }

    // Collect deps that aren't already satisfied
    const unsatisfied = dep.requires.filter(([depPage, depFn]) => {
      return !permissions[depPage]?.functions[depFn];
    });

    if (unsatisfied.length === 0) {
      // All deps already met — apply directly
      onChange(nextPerms);
      return;
    }

    // Build perms with all required deps auto-enabled
    let autoPerms = nextPerms;
    for (const [depPage, depFn] of dep.requires) {
      const locked = LOCKED_FUNCTIONS[depPage] ?? [];
      const depFns = PAGE_FUNCTIONS[depPage];
      const currentPage = autoPerms[depPage];
      const wasEnabled = currentPage.enabled;

      // If enabling a previously-disabled page, force locked functions too
      const updatedFunctions: Record<string, boolean> = { ...currentPage.functions };
      updatedFunctions[depFn] = true;

      if (!wasEnabled) {
        for (const lf of locked) {
          updatedFunctions[lf] = true;
        }
        // Ensure all page function keys exist
        for (const f of depFns) {
          if (!(f in updatedFunctions)) updatedFunctions[f] = false;
        }
      }

      autoPerms = {
        ...autoPerms,
        [depPage]: {
          enabled: true,
          functions: updatedFunctions,
        },
      };
    }

    setConfirmState({ open: true, dep, pendingPerms: autoPerms });
  }

  function handleConfirm() {
    if (confirmState.pendingPerms) {
      onChange(confirmState.pendingPerms);
    }
    setConfirmState(CLOSED_CONFIRM);
  }

  function handleCancel() {
    setConfirmState(CLOSED_CONFIRM);
  }

  // ── Render dep labels for dialog ─────────────────────────────────────────
  const dep = confirmState.dep;
  const depItems = dep?.requires.map(([depPage, depFn]) => ({
    pageLabel: PAGE_META[depPage].label,
    fnLabel: FUNCTION_LABELS[depFn] ?? depFn,
    key: `${depPage}:${depFn}`,
  }));

  return (
    <TooltipProvider>
      <div className="space-y-3">
        {PAGE_KEYS.map((page) => {
          const meta = PAGE_META[page];
          const Icon = meta.icon;
          const pagePerm = permissions[page];
          const isEnabled = pagePerm.enabled;
          const locked = LOCKED_FUNCTIONS[page] ?? [];
          const fns = PAGE_FUNCTIONS[page];
          const tint = PAGE_TINT[page] ?? DEFAULT_TINT;

          return (
            <Card
              key={page}
              className="transition-shadow"
              style={
                isEnabled
                  ? { boxShadow: `inset 4px 0 0 0 ${tint.fg}` }
                  : undefined
              }
            >
              <CardHeader className="border-b">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="flex size-8 shrink-0 items-center justify-center rounded-md"
                      style={{ background: tint.bg, color: tint.fg }}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle>{meta.label}</CardTitle>
                      <CardDescription>{meta.description}</CardDescription>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isEnabled && (
                      <Badge
                        className="text-xs border-transparent"
                        style={{ background: tint.bg, color: tint.fg }}
                      >
                        Enabled
                      </Badge>
                    )}
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(val) => handlePageToggle(page, val)}
                    />
                  </div>
                </div>
              </CardHeader>

              {isEnabled && (
                <CardContent className="pt-3 pb-2">
                  <div className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
                    {fns.map((fn) => {
                      const isLocked = locked.includes(fn);
                      const isChecked = pagePerm.functions[fn] ?? false;
                      const label = FUNCTION_LABELS[fn] ?? fn;

                      if (isLocked) {
                        return (
                          <Tooltip key={fn}>
                            <TooltipTrigger
                              tabIndex={-1}
                              className="flex w-full cursor-default items-center justify-between rounded-md px-2 py-1.5"
                            >
                              <span className="text-sm text-muted-foreground">{label}</span>
                              <Switch
                                checked
                                disabled
                                size="sm"
                                aria-label={label}
                              />
                            </TooltipTrigger>
                            <TooltipContent>Required when page is enabled</TooltipContent>
                          </Tooltip>
                        );
                      }

                      return (
                        <div
                          key={fn}
                          className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted/50"
                        >
                          <span className="text-sm">{label}</span>
                          <Switch
                            checked={isChecked}
                            onCheckedChange={(val) => handleFunctionToggle(page, fn, val)}
                            size="sm"
                            aria-label={label}
                          />
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Dependency confirmation dialog */}
      <AlertDialog open={confirmState.open} onOpenChange={(open) => !open && handleCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable required permissions?</AlertDialogTitle>
            <AlertDialogDescription>
              This permission requires the following to be enabled automatically:
            </AlertDialogDescription>
          </AlertDialogHeader>

          {depItems && depItems.length > 0 && (
            <ul className="space-y-1 text-sm">
              {depItems.map((item) => (
                <li key={item.key} className="flex items-center gap-2">
                  <span className="font-medium">{item.pageLabel}</span>
                  <span className="text-muted-foreground">—</span>
                  <span>{item.fnLabel}</span>
                </li>
              ))}
            </ul>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>Enable all</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
