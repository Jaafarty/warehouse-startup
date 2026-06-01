"use client";

import { useState, type ReactNode } from "react";
import { createCategory } from "@/app/actions/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface NewCategoryDialogProps {
  storeId: string;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  onCreated?: (name: string) => void;
}

export function NewCategoryDialog({
  storeId,
  triggerLabel,
  triggerClassName,
  onCreated,
}: NewCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    const name = String(formData.get("name") ?? "").trim();
    const result = await createCategory(storeId, formData);
    setPending(false);
    if (result.success) {
      toast.success("Category created");
      setOpen(false);
      if (name) onCreated?.(name);
    } else {
      toast.error(result.error ?? "Failed to create category");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create a product category for this store.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ncd-name">Name</Label>
            <Input
              id="ncd-name"
              name="name"
              placeholder="e.g. Electronics"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ncd-desc">Description (optional)</Label>
            <Input
              id="ncd-desc"
              name="description"
              placeholder="Category description"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating..." : "Create Category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
