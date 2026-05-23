"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import { Tag, Plus, Pencil, Trash2, Search, Sparkles, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/extract-error";
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
import { PageHeader } from "@/components/layout/page-header";

export default function CategoriesPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const categories = useQuery(
    api.categories.list,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);

  const role = store?.role;
  const isPrivileged = role === "owner" || role === "admin";
  const fns = store?.effectivePermissions?.categories?.functions ?? {};
  const can = (fn: string) => isPrivileged || (fns[fn] ?? false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!categories) return [];
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
    );
  }, [categories, search]);

  const stats = useMemo(() => {
    if (!categories) return { total: 0, withDesc: 0, recent: 0 };
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return {
      total: categories.length,
      withDesc: categories.filter((c) => c.description?.trim()).length,
      recent: categories.filter((c) => (c._creationTime ?? 0) >= weekAgo).length,
    };
  }, [categories]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || !userId) return;
    setCreating(true);
    try {
      await createCategory({
        storeId: storeId as Id<"stores">,
        userId,
        name,
        description: newDesc.trim() || undefined,
      });
      toast.success("Category created");
      setNewName("");
      setNewDesc("");
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setCreating(false);
    }
  }

  function startEdit(cat: { _id: string; name: string; description?: string }) {
    setEditingId(cat._id);
    setEditName(cat.name);
    setEditDesc(cat.description ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditDesc("");
  }

  async function handleSave(categoryId: string) {
    const name = editName.trim();
    if (!name || !userId) return;
    setSaving(true);
    try {
      await updateCategory({
        categoryId: categoryId as Id<"categories">,
        userId,
        name,
        description: editDesc.trim() || undefined,
      });
      toast.success("Category updated");
      cancelEdit();
    } catch (err) {
      toast.error(friendlyMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(categoryId: string) {
    if (!userId) return;
    try {
      await removeCategory({
        categoryId: categoryId as Id<"categories">,
        userId,
      });
      toast.success("Category removed");
    } catch (err) {
      toast.error(friendlyMessage(err));
    }
  }

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Tag}
        title="Categories"
        subtitle="Group your products. Removing a category leaves its products uncategorized."
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5 min-w-0">
          {can("create_category") && (
            <Card>
              <CardHeader>
                <CardTitle>New category</CardTitle>
                <CardDescription>
                  Create a new category for your products.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="cat-name">Name</Label>
                      <Input
                        id="cat-name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Beverages"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cat-desc">Description (optional)</Label>
                      <Input
                        id="cat-desc"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        placeholder="Short description"
                      />
                    </div>
                  </div>
                  <Button type="submit" disabled={creating || !newName.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    {creating ? "Creating…" : "Add category"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>All categories</CardTitle>
                  <CardDescription>
                    {categories === undefined
                      ? "Loading…"
                      : `${filtered.length} of ${categories.length}`}
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search categories…"
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {categories === undefined ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {search ? "No matches." : "No categories yet."}
                </p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((cat) => (
                    <div
                      key={cat._id}
                      className="flex items-center gap-2 rounded-lg border px-3 py-2"
                    >
                      {editingId === cat._id ? (
                        <>
                          <div className="flex flex-1 gap-2 min-w-0">
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="flex-1"
                              autoFocus
                            />
                            <Input
                              value={editDesc}
                              onChange={(e) => setEditDesc(e.target.value)}
                              placeholder="Description (optional)"
                              className="flex-1"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleSave(cat._id)}
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
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {cat.name}
                            </p>
                            {cat.description && (
                              <p className="text-sm text-muted-foreground truncate">
                                {cat.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {can("edit_category") && (
                              <Button
                                size="icon-sm"
                                variant="ghost"
                                onClick={() => startEdit(cat)}
                                aria-label="Edit category"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {can("remove_category") && (
                              <AlertDialog>
                                <AlertDialogTrigger
                                  render={
                                    <Button
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label="Remove category"
                                      className="text-destructive hover:text-destructive"
                                    />
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>
                                      Remove &apos;{cat.name}&apos;?
                                    </AlertDialogTitle>
                                    <AlertDialogDescription>
                                      All products in this category will become
                                      uncategorized.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      variant="destructive"
                                      onClick={() => handleRemove(cat._id)}
                                    >
                                      Remove
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
              <CardTitle className="flex items-center gap-2 text-base">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                At a glance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-bold">{stats.total}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  With description
                </span>
                <span className="font-medium">{stats.withDesc}</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Added this week
                </span>
                <span className="font-medium">{stats.recent}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                Tips
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>Use short, distinct names — they show in the inventory list.</p>
              <p>
                Descriptions help teammates pick the right category when
                creating new products.
              </p>
              <p>
                Removing a category does not delete its products — they become
                uncategorized.
              </p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
