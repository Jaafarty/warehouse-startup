"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery, useMutation } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import type { StorePermissions } from "@ware-house/shared";
import { PermissionEditor } from "@/components/permissions/permission-editor";
import { friendlyMessage } from "@/lib/extract-error";

export default function EditRolePage() {
  const { storeId, roleId } = useParams<{ storeId: string; roleId: string }>();
  const { userId } = useCurrentUser();
  const router = useRouter();

  const updateRole = useMutation(api.storeRoles.update);

  const customRoles = useQuery(
    api.storeRoles.listByStore,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );

  const role = customRoles?.find((r) => r._id === roleId);

  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<StorePermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (role && !initialized) {
      setName(role.name);
      setPermissions(role.permissions as StorePermissions);
      setInitialized(true);
    }
  }, [role, initialized]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId || !permissions) return;
    if (!name.trim()) { toast.error("Role name is required."); return; }
    setSaving(true);
    try {
      await updateRole({
        storeId: storeId as Id<"stores">,
        userId: userId!,
        roleId: roleId as Id<"storeRoles">,
        name: name.trim(),
        permissions,
      });
      toast.success("Role updated");
      router.push(`/store/${storeId}/roles`);
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const isLoading = customRoles === undefined;
  const notFound = !isLoading && !role;

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-4">
        <Link href={`/store/${storeId}/roles`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          {isLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : notFound ? (
            <h1 className="text-2xl font-bold">Role Not Found</h1>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Edit Role: {role!.name}</h1>
              <p className="text-muted-foreground">Update the role name and page access.</p>
            </>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {notFound && (
        <p className="text-muted-foreground">
          This role does not exist or you do not have permission to edit it.
        </p>
      )}

      {!isLoading && role && permissions && (
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
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
