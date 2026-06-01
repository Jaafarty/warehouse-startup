"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ShieldPlus, Layers, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PAGE_KEYS, PAGE_FUNCTIONS } from "@ware-house/shared";
import type { StorePermissions } from "@ware-house/shared";
import { PermissionEditor } from "@/components/permissions/permission-editor";
import { friendlyMessage } from "@/lib/extract-error";
import { PageHeader } from "@/components/layout/page-header";
import { PAGE_META } from "@/components/permissions/page-meta";

function buildEmptyPermissions(): StorePermissions {
  const perms: Record<string, { enabled: boolean; functions: Record<string, boolean> }> = {};
  for (const page of PAGE_KEYS) {
    const functions: Record<string, boolean> = {};
    for (const fn of PAGE_FUNCTIONS[page]) functions[fn] = false;
    perms[page] = { enabled: false, functions };
  }
  return perms as StorePermissions;
}

export default function NewRolePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();
  const router = useRouter();

  const createRole = useMutation(api.storeRoles.create);

  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<StorePermissions>(buildEmptyPermissions());
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => {
    const enabledPages: { key: string; label: string; fnCount: number; total: number }[] = [];
    let totalFns = 0;
    let enabledFns = 0;
    for (const key of PAGE_KEYS) {
      const p = permissions[key];
      const total = PAGE_FUNCTIONS[key].length;
      const granted = p?.functions
        ? Object.values(p.functions).filter(Boolean).length
        : 0;
      totalFns += total;
      enabledFns += granted;
      if (p?.enabled) {
        const meta = (PAGE_META as Record<string, { label: string }>)[key];
        enabledPages.push({
          key,
          label: meta?.label ?? key,
          fnCount: granted,
          total,
        });
      }
    }
    return { enabledPages, totalFns, enabledFns };
  }, [permissions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    if (!name.trim()) { toast.error("Role name is required."); return; }
    setSaving(true);
    try {
      await createRole({
        storeId: storeId as Id<"stores">,
        userId: userId!,
        name: name.trim(),
        permissions,
      });
      toast.success("Role created");
      router.push(`/store/${storeId}/roles`);
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={ShieldPlus}
        title="New Role"
        subtitle="Define a custom role with specific page and function access."
        right={
          <>
            <Link href={`/store/${storeId}/roles`}>
              <Button type="button" variant="outline">Cancel</Button>
            </Link>
            <Button type="submit" form="new-role-form" disabled={saving || !name.trim()}>
              {saving ? "Creating..." : "Create Role"}
            </Button>
          </>
        }
      />

      <form id="new-role-form" onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cashier"
                  required
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Page Access</CardTitle>
            </CardHeader>
            <CardContent>
              <PermissionEditor permissions={permissions} onChange={setPermissions} />
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers className="h-4 w-4 text-muted-foreground" />
                Live preview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium truncate">
                  {name.trim() || "Untitled role"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Pages</p>
                  <p className="text-xl font-bold">
                    {summary.enabledPages.length}
                    <span className="text-sm text-muted-foreground font-normal">
                      {" "}/ {PAGE_KEYS.length}
                    </span>
                  </p>
                </div>
                <div className="rounded-lg border p-2.5">
                  <p className="text-xs text-muted-foreground">Functions</p>
                  <p className="text-xl font-bold">
                    {summary.enabledFns}
                    <span className="text-sm text-muted-foreground font-normal">
                      {" "}/ {summary.totalFns}
                    </span>
                  </p>
                </div>
              </div>
              {summary.enabledPages.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground">Enabled pages</p>
                  <div className="space-y-1">
                    {summary.enabledPages.map((p) => (
                      <div
                        key={p.key}
                        className="flex items-center justify-between text-xs rounded-md border px-2 py-1.5"
                      >
                        <span className="font-medium truncate">{p.label}</span>
                        <span className="text-muted-foreground tabular-nums">
                          {p.fnCount}/{p.total}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Info className="h-4 w-4 text-muted-foreground" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Owner and admin roles outrank custom roles and can manage them.
              </p>
              <p>
                Some functions auto-enable related ones — e.g. editing usually
                needs viewing.
              </p>
              <p>You can edit this role&apos;s permissions later.</p>
            </CardContent>
          </Card>
        </aside>
      </form>
    </div>
  );
}
