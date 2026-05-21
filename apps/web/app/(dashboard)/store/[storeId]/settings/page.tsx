"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { updateStore, deleteStore } from "@/app/actions/stores";
import { setShiftsEnabled } from "@/app/actions/shifts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Settings as SettingsIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

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

  async function handleShiftsToggle(enabled: boolean) {
    const result = await setShiftsEnabled(storeId, enabled);
    if (result.success) {
      toast.success(enabled ? "Shifts enabled" : "Shifts disabled");
    } else {
      toast.error(result.error ?? "Failed to update");
    }
  }

  if (!store) return null;
  const isOwner = store.role === "owner";
  const canManageStore = isOwner || store.role === "admin";
  const canDelete = isOwner && confirmText === store.name;

  return (
    <div
      style={{ padding: "var(--wh-density-pad)" }}
      className="max-w-2xl space-y-5"
    >
      <PageHeader
        icon={SettingsIcon}
        title="Store Settings"
        subtitle="General configuration and preferences."
      />

      <Card>
        <CardHeader>
          <CardTitle>General</CardTitle>
          <CardDescription>Update your store details.</CardDescription>
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

      {canManageStore && (
        <Card>
          <CardHeader>
            <CardTitle>Cashier Shifts</CardTitle>
            <CardDescription>
              When enabled, cashiers must open a shift before recording sales or
              returns. The drawer is reconciled at close.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Require shifts</p>
                <p className="text-xs text-muted-foreground">
                  {store.shiftsEnabled
                    ? "Sales and returns are blocked without an active shift."
                    : "Sales and returns work without a shift."}
                </p>
              </div>
              <Switch
                checked={store.shiftsEnabled ?? false}
                onCheckedChange={handleShiftsToggle}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Danger Zone</CardTitle>
            <CardDescription>
              Deleting the store hides it from everyone and cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog
              open={deleteOpen}
              onOpenChange={(open) => {
                setDeleteOpen(open);
                if (!open) setConfirmText("");
              }}
            >
              <AlertDialogTrigger
                className="inline-flex h-9 items-center justify-center rounded-lg bg-destructive px-4 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Store
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this store?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will hide the store from all members. To confirm, type{" "}
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
  );
}
