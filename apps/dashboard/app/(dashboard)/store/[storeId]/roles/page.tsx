"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery, useMutation } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Plus, Pencil, Trash2, Users, Shield } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { PAGE_KEYS } from "@ware-house/shared";
import { friendlyMessage } from "@/lib/extract-error";

export default function RolesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const customRoles = useQuery(
    api.storeRoles.listByStore,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const removeRole = useMutation(api.storeRoles.remove);

  async function handleDelete(roleId: string) {
    if (!userId) return;
    try {
      await removeRole({ storeId: storeId as Id<"stores">, userId: userId!, roleId: roleId as Id<"storeRoles"> });
      toast.success("Role deleted");
    } catch (err) {
      toast.error(friendlyMessage(err));
    }
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Shield}
        title="Custom Roles"
        subtitle="Create roles with specific page and feature access."
        right={
          <Link href={`/store/${storeId}/roles/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" /> New Role
            </Button>
          </Link>
        }
      />

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
          {customRoles.map((role) => (
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
                    <Link href={`/store/${storeId}/roles/${role._id}/edit`}>
                      <Button variant="ghost" size="icon">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </Link>
                    <AlertDialog>
                      <AlertDialogTrigger className="inline-flex items-center justify-center rounded-md size-8 text-destructive hover:bg-muted hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
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
