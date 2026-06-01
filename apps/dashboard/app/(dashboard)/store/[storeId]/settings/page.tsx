"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { updateStore, deleteStore } from "@/app/actions/stores";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Settings as SettingsIcon,
  Store as StoreIcon,
  ShieldAlert,
  Info,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { formatDate } from "@ware-house/shared";

// Small colored chip so each section reads with a hint of color rather than grey.
function HeaderChip({
  icon: Icon,
  fg,
  bg,
}: {
  icon: LucideIcon;
  fg: string;
  bg: string;
}) {
  return (
    <div
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
      style={{ background: bg, color: fg }}
    >
      <Icon className="h-[18px] w-[18px]" />
    </div>
  );
}

export default function StoreSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const [pending, setPending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function handleUpdate(formData: FormData) {
    setPending(true);
    const result = await updateStore(storeId, formData);
    setPending(false);
    if (result.success) {
      toast.success("Store updated");
    } else {
      toast.error(result.error ?? "Failed to update");
    }
  }

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteStore(storeId);
    setDeleting(false);
    if (result && !result.success) {
      toast.error(result.error ?? "Failed to delete store");
    }
  }

  if (!store) return null;
  const isOwner = store.role === "owner";
  const canManageStore = isOwner || store.role === "admin";
  const canDelete = isOwner && confirmText === store.name;

  const roleTint =
    store.role === "owner"
      ? { fg: "var(--color-role-owner)", bg: "var(--primary-soft)" }
      : store.role === "admin"
        ? { fg: "var(--color-role-admin)", bg: "oklch(0.95 0.05 235)" }
        : { fg: "var(--muted-foreground)", bg: "var(--muted)" };

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={SettingsIcon}
        title="Store Settings"
        subtitle="General configuration and preferences."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <HeaderChip
                  icon={StoreIcon}
                  fg="var(--primary)"
                  bg="var(--primary-soft)"
                />
                <div className="min-w-0">
                  <CardTitle>General</CardTitle>
                  <CardDescription>Update your store details.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form action={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Store Name</Label>
                  <Input
                    id="name"
                    name="name"
                    defaultValue={store.name}
                    required
                    minLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={store.description ?? ""}
                  />
                </div>
                <Button type="submit" disabled={pending}>
                  {pending ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {isOwner && (
            <Card className="border-destructive/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <HeaderChip
                    icon={ShieldAlert}
                    fg="var(--destructive)"
                    bg="oklch(0.94 0.04 27)"
                  />
                  <div className="min-w-0">
                    <CardTitle className="text-destructive">
                      Danger Zone
                    </CardTitle>
                    <CardDescription>
                      Deleting the store hides it from everyone and cannot be
                      undone.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <AlertDialog
                  open={deleteOpen}
                  onOpenChange={(open) => {
                    setDeleteOpen(open);
                    if (!open) setConfirmText("");
                  }}
                >
                  <AlertDialogTrigger className="inline-flex h-9 items-center justify-center rounded-lg bg-destructive px-4 text-sm font-medium text-white hover:bg-destructive/90">
                    Delete Store
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this store?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will hide the store from all members. To confirm,
                        type{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {store.name}
                        </span>{" "}
                        below.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-name" className="sr-only">
                        Confirm store name
                      </Label>
                      <Input
                        id="confirm-name"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder={store.name}
                        autoComplete="off"
                      />
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={deleting}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        disabled={!canDelete || deleting}
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? "Deleting..." : "Delete Store"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <HeaderChip
                  icon={StoreIcon}
                  fg="var(--primary)"
                  bg="var(--primary-soft)"
                />
                <CardTitle className="text-base">Store info</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Name</p>
                <p className="font-medium truncate">{store.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Your role</p>
                <span
                  className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize"
                  style={{ background: roleTint.bg, color: roleTint.fg }}
                >
                  {store.role}
                </span>
              </div>
              {store._creationTime && (
                <div>
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {formatDate(store._creationTime)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <HeaderChip
                  icon={Info}
                  fg="var(--accent-foreground)"
                  bg="var(--accent-soft)"
                />
                <CardTitle className="text-base">Need more?</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                Manage who can do what on the Members and Roles pages.
              </p>
              <p>
                Set the USD ↔ LBP rate on the Exchange Rate page — it locks per
                sale.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
