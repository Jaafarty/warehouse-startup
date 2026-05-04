"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Tag, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/extract-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ManageCategoriesDialogProps {
  storeId: string;
  userId: string;
  canCreate: boolean;
  canEdit: boolean;
  canRemove: boolean;
}

export function ManageCategoriesDialog({
  storeId,
  userId,
  canCreate,
  canEdit,
  canRemove,
}: ManageCategoriesDialogProps) {
  const [open, setOpen] = useState(false);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const categories = useQuery(
    api.categories.list,
    open ? { storeId: storeId as any, userId: userId as any } : "skip"
  );

  const createCategory = useMutation(api.categories.create);
  const updateCategory = useMutation(api.categories.update);
  const removeCategory = useMutation(api.categories.remove);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    try {
      await createCategory({
        storeId: storeId as any,
        userId: userId as any,
        name,
        description: newDesc.trim() || undefined,
      });
      toast.success("Category created");
      setNewName("");
      setNewDesc("");
    } catch (err) {
      toast.error(friendlyMessage(err));
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
    if (!name) return;
    try {
      await updateCategory({
        categoryId: categoryId as any,
        userId: userId as any,
        name,
        description: editDesc.trim() || undefined,
      });
      toast.success("Category updated");
      cancelEdit();
    } catch (err) {
      toast.error(friendlyMessage(err));
    }
  }

  async function handleRemove(categoryId: string) {
    try {
      await removeCategory({
        categoryId: categoryId as any,
        userId: userId as any,
      });
      toast.success("Category removed");
    } catch (err) {
      toast.error(friendlyMessage(err));
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" />
        }
      >
        <Tag className="h-4 w-4 mr-1.5" />
        Manage Categories
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Manage Categories</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Create form */}
          {canCreate && (
            <form onSubmit={handleCreate} className="flex gap-2">
              <Input
                placeholder="Category name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="flex-1"
              />
              <Input
                placeholder="Description (optional)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" disabled={!newName.trim()}>
                Add
              </Button>
            </form>
          )}

          {/* Category list */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {categories === undefined ? (
              <p className="text-sm text-muted-foreground py-2">Loading...</p>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No categories yet.
              </p>
            ) : (
              categories.map((cat: any) => (
                <div key={cat._id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  {editingId === cat._id ? (
                    <>
                      <div className="flex flex-1 gap-2">
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
                        disabled={!editName.trim()}
                      >
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{cat.name}</p>
                        {cat.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {cat.description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {canEdit && (
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            onClick={() => startEdit(cat)}
                            aria-label="Edit category"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canRemove && (
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
                                  All products in this category will become uncategorized.
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
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
