"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PAGE_KEYS, PAGE_FUNCTIONS } from "@ware-house/shared";
import type { StorePermissions } from "@ware-house/shared";
import { PermissionEditor } from "@/components/permissions/permission-editor";
import { friendlyMessage } from "@/lib/extract-error";

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
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/store/${storeId}/roles`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Role</h1>
          <p className="text-muted-foreground">Define a custom role with specific page access.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
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

        <div className="flex justify-end gap-3">
          <Link href={`/store/${storeId}/roles`}>
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating..." : "Create Role"}
          </Button>
        </div>
      </form>
    </div>
  );
}
