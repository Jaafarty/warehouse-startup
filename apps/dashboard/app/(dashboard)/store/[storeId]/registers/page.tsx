"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import { CreditCard, Plus, Pencil, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/extract-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { PageHeader } from "@/components/layout/page-header";

export default function RegistersPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const registers = useQuery(
    api.registers.list,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const createRegister = useMutation(api.registers.create);
  const updateRegister = useMutation(api.registers.update);
  const removeRegister = useMutation(api.registers.remove);

  const role = store?.role;
  const isPrivileged = role === "owner" || role === "admin";
  const fns = store?.effectivePermissions?.registers?.functions ?? {};
  const can = (fn: string) => isPrivileged || (fns[fn] ?? false);

  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  const { active, archived } = useMemo(() => {
    const list = registers ?? [];
    return {
      active: list.filter((r) => r.isActive),
      archived: list.filter((r) => !r.isActive),
    };
  }, [registers]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !userId) return;
    setCreating(true);
    try {
      await createRegister({ storeId: storeId as Id<"stores">, userId, name });
      toast.success("Register created");
      setNewName("");
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(reg: { _id: string; name: string }) {
    setEditingId(reg._id);
    setEditName(reg.name);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  async function handleSave(registerId: string) {
    const name = editName.trim();
    if (!name || !userId) return;
    setSaving(true);
    try {
      await updateRegister({
        registerId: registerId as Id<"registers">,
        userId,
        name,
      });
      toast.success("Register updated");
      cancelEdit();
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(registerId: string) {
    if (!userId) return;
    try {
      await removeRegister({
        registerId: registerId as Id<"registers">,
        userId,
      });
      toast.success("Register archived");
    } catch (err) {
      toast.error(friendlyMessage(err));
    }
  }

  async function handleRestore(registerId: string) {
    if (!userId) return;
    try {
      await updateRegister({
        registerId: registerId as Id<"registers">,
        userId,
        isActive: true,
      });
      toast.success("Register restored");
    } catch (err) {
      toast.error(friendlyMessage(err));
    }
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={CreditCard}
        title="Registers"
        subtitle="Physical cash registers. Cashiers pick one when opening a shift; each keeps its own drawer balance and carry-over."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {can("create_register") && (
            <Card>
              <CardHeader>
                <CardTitle>New register</CardTitle>
                <CardDescription>
                  Add a register. The first register you create switches this
                  store to per-register shifts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="flex gap-3">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="register-name" className="sr-only">
                      Name
                    </Label>
                    <Input
                      id="register-name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Front counter"
                      required
                    />
                  </div>
                  <Button type="submit" disabled={creating || !newName.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {creating ? "Creating…" : "Add register"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Registers</CardTitle>
              <CardDescription>
                {registers === undefined
                  ? "Loading…"
                  : `${active.length} active${
                      archived.length ? `, ${archived.length} archived` : ""
                    }`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {registers === undefined ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : registers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No registers yet. This store uses a single shared drawer until
                  you add one.
                </p>
              ) : (
                <div className="space-y-2">
                  {[...active, ...archived].map((reg) => (
                    <div
                      key={reg._id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      {editingId === reg._id ? (
                        <>
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button
                            size="sm"
                            onClick={() => handleSave(reg._id)}
                            disabled={saving || !editName.trim()}
                          >
                            {saving ? "Saving…" : "Save"}
                          </Button>
                          <Button size="sm" variant="outline" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="flex flex-1 items-center gap-2 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {reg.name}
                            </p>
                            {reg.isActive && reg.inUse && (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--color-success)]/40 bg-[color:var(--color-success-bg)] px-2 py-0.5 text-[11px] font-medium text-[color:var(--color-success)]">
                                <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
                                In use{reg.heldByName ? ` · ${reg.heldByName}` : ""}
                              </span>
                            )}
                            {!reg.isActive && (
                              <Badge variant="secondary">Archived</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {reg.isActive ? (
                              <>
                                {can("edit_register") && (
                                  <Button
                                    size="icon-sm"
                                    variant="ghost"
                                    onClick={() => startEdit(reg)}
                                    aria-label="Edit register"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                                {can("remove_register") && (
                                  <AlertDialog>
                                    <AlertDialogTrigger
                                      render={
                                        <Button
                                          size="icon-sm"
                                          variant="ghost"
                                          aria-label="Archive register"
                                          className="text-destructive hover:text-destructive"
                                        />
                                      }
                                    >
                                      <Archive className="h-3.5 w-3.5" />
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Archive &apos;{reg.name}&apos;?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          It can no longer be selected for new
                                          shifts. History is kept and you can
                                          restore it later. Blocked while it has
                                          an open shift.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          variant="destructive"
                                          onClick={() => handleArchive(reg._id)}
                                        >
                                          Archive
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                )}
                              </>
                            ) : (
                              can("edit_register") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRestore(reg._id)}
                                >
                                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                                  Restore
                                </Button>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">How registers work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>
                With no registers, the store uses one shared drawer (current
                behaviour).
              </p>
              <p>
                Once you add a register, opening a shift requires picking one,
                and a register can only have one open shift at a time.
              </p>
              <p>
                Carry-over and drawer balances are tracked per register — the
                next cashier on a register inherits the last counted balance.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
