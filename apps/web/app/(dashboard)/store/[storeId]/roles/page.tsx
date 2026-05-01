"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { ConvexError } from "convex/values";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PAGE_KEYS, PAGE_FUNCTIONS } from "@ware-house/shared";
import type { StorePermissions } from "@ware-house/shared";

function buildEmptyPermissions(): StorePermissions {
  const perms: any = {};
  for (const page of PAGE_KEYS) {
    const functions: Record<string, boolean> = {};
    for (const fn of PAGE_FUNCTIONS[page]) {
      functions[fn] = false;
    }
    perms[page] = { enabled: false, functions };
  }
  return perms;
}

function PermissionEditor({
  permissions,
  onChange,
}: {
  permissions: StorePermissions;
  onChange: (p: StorePermissions) => void;
}) {
  const [openPages, setOpenPages] = useState<Set<string>>(new Set());

  function togglePage(page: string) {
    setOpenPages((prev) => {
      const next = new Set(prev);
      next.has(page) ? next.delete(page) : next.add(page);
      return next;
    });
  }

  function setPageEnabled(page: string, enabled: boolean) {
    const updated = {
      ...permissions,
      [page]: { ...permissions[page as keyof StorePermissions], enabled },
    };
    onChange(updated as StorePermissions);
  }

  function setFunction(page: string, fn: string, value: boolean) {
    const pagePerms = permissions[page as keyof StorePermissions];
    const updated = {
      ...permissions,
      [page]: {
        ...pagePerms,
        functions: { ...pagePerms.functions, [fn]: value },
      },
    };
    onChange(updated as StorePermissions);
  }

  function formatLabel(key: string) {
    return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-2">
      {PAGE_KEYS.map((page) => {
        const pagePerms = permissions[page];
        const isOpen = openPages.has(page);
        return (
          <div key={page} className="border rounded-lg">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => togglePage(page)} className="text-muted-foreground">
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
                <span className="font-medium capitalize">{page}</span>
              </div>
              <Switch
                checked={pagePerms.enabled}
                onCheckedChange={(v) => setPageEnabled(page, v)}
              />
            </div>
            {isOpen && pagePerms.enabled && (
              <div className="px-4 pb-3 space-y-2 border-t pt-3">
                {PAGE_FUNCTIONS[page].map((fn) => (
                  <div key={fn} className="flex items-center justify-between">
                    <Label className="text-sm font-normal">{formatLabel(fn)}</Label>
                    <Switch
                      checked={pagePerms.functions[fn] ?? false}
                      onCheckedChange={(v) => setFunction(page, fn, v)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function RolesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const customRoles = useQuery(
    api.storeRoles.listByStore,
    userId ? { storeId: storeId as any, userId: userId as any } : "skip"
  );

  const createRole = useMutation(api.storeRoles.create);
  const updateRole = useMutation(api.storeRoles.update);
  const removeRole = useMutation(api.storeRoles.remove);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<any>(null);
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<StorePermissions>(buildEmptyPermissions());
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setName("");
    setPermissions(buildEmptyPermissions());
    setCreateOpen(true);
  }

  function openEdit(role: any) {
    setName(role.name);
    setPermissions(role.permissions as StorePermissions);
    setEditingRole(role);
  }

  async function handleSave() {
    if (!userId) return;
    if (!name.trim()) { toast.error("Role name is required."); return; }
    setSaving(true);
    try {
      if (editingRole) {
        await updateRole({ storeId: storeId as any, userId: userId as any, roleId: editingRole._id, name, permissions });
        toast.success("Role updated");
        setEditingRole(null);
      } else {
        await createRole({ storeId: storeId as any, userId: userId as any, name, permissions });
        toast.success("Role created");
        setCreateOpen(false);
      }
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as any)?.message : "Something went wrong.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(roleId: string) {
    if (!userId) return;
    try {
      await removeRole({ storeId: storeId as any, userId: userId as any, roleId: roleId as any });
      toast.success("Role deleted");
    } catch (err) {
      const msg = err instanceof ConvexError ? (err.data as any)?.message : "Something went wrong.";
      toast.error(msg);
    }
  }

  const roleDialogContent = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Role Name</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cashier" />
      </div>
      <div className="space-y-2">
        <Label>Page Access</Label>
        <PermissionEditor permissions={permissions} onChange={setPermissions} />
      </div>
      <Button onClick={handleSave} className="w-full" disabled={saving}>
        {saving ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
      </Button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Custom Roles</h1>
          <p className="text-muted-foreground">Create roles with specific page and feature access.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger
            onClick={openCreate}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="h-4 w-4 mr-2" /> New Role
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Custom Role</DialogTitle>
            </DialogHeader>
            {roleDialogContent}
          </DialogContent>
        </Dialog>
      </div>

      {customRoles === undefined ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : customRoles.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center gap-3">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No custom roles yet</p>
            <p className="text-sm text-muted-foreground">Create roles to give members specific page access.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {customRoles.map((role: any) => (
            <Card key={role._id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-base">{role.name}</CardTitle>
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {role.memberCount}
                    </Badge>
                  </div>
                  <div className="flex gap-2">
                    <Dialog open={editingRole?._id === role._id} onOpenChange={(o) => !o && setEditingRole(null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" onClick={() => openEdit(role)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Role</DialogTitle>
                        </DialogHeader>
                        {roleDialogContent}
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{role.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {role.memberCount > 0
                              ? `${role.memberCount} member(s) have this role. Reassign them first.`
                              : "This cannot be undone."}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            disabled={role.memberCount > 0}
                            onClick={() => handleDelete(role._id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  {PAGE_KEYS.filter((p) => role.permissions[p]?.enabled).map((p) => (
                    <Badge key={p} variant="secondary" className="capitalize">{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
