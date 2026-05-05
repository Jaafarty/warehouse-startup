"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useCurrentUser } from "@/lib/use-current-user";
import { createCustomer } from "@/app/actions/customers";
import { Plus, X, Search } from "lucide-react";
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

export interface SelectedCustomer {
  _id: string;
  name: string;
  phone: string;
}

interface Props {
  storeId: string;
  value: SelectedCustomer | null;
  onChange: (next: SelectedCustomer | null) => void;
}

export function CustomerPicker({ storeId, value, onChange }: Props) {
  const { userId } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const customers = useQuery(
    api.customers.list,
    userId
      ? { storeId: storeId as Id<"stores">, userId, search }
      : "skip"
  );

  async function handleCreate() {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setCreating(true);
    const result = await createCustomer(storeId, newName, newPhone);
    setCreating(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to create customer");
      return;
    }
    onChange({
      _id: result.customerId as string,
      name: newName.trim(),
      phone: newPhone.trim(),
    });
    setNewName("");
    setNewPhone("");
    setOpen(false);
    toast.success("Customer created");
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground truncate">{value.phone}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label="Clear customer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            className="pl-8"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md border px-3 h-9 text-sm font-medium hover:bg-muted">
            <Plus className="h-4 w-4 mr-1" />
            New
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
              <DialogDescription>
                Customer is identified by phone number within this store.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create customer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {search && customers && customers.length > 0 && (
        <div className="rounded-md border max-h-56 overflow-y-auto divide-y">
          {customers.map((c: any) => (
            <button
              key={c._id}
              type="button"
              onClick={() =>
                onChange({ _id: c._id, name: c.name, phone: c.phone })
              }
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </button>
          ))}
        </div>
      )}
      {search && customers && customers.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">
          No matches. Use "+ New" to create a customer.
        </p>
      )}
    </div>
  );
}
