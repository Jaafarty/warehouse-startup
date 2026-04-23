"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";
import { createStore } from "@/app/actions/stores";
import { Plus, Store } from "lucide-react";
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
    const { userId } = useCurrentUser();

    const stores = useQuery(
        api.stores.listByUser,
        userId ? { userId: userId as any } : "skip",
    );

    const [open, setOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, setPending] = useState(false);

    async function handleCreate(formData: FormData) {
        setPending(true);
        setError(null);
        const result = await createStore(formData);
        setPending(false);
        if (result && !result.success) {
            setError(result.error ?? "Failed to create store");
        } else {
            setOpen(false);
        }
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Your Stores</h1>
                    <p className="text-muted-foreground">
                        Select a store or create a new one.
                    </p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80">
                        <Plus className="h-4 w-4 mr-2" />
                        New Store
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Create a new store</DialogTitle>
                            <DialogDescription>
                                Give your store a name and optional description.
                            </DialogDescription>
                        </DialogHeader>
                        <form action={handleCreate} className="space-y-4">
                            {error && (
                                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                    {error}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="name">Store Name</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    placeholder="My Store"
                                    required
                                    minLength={2}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">
                                    Description (optional)
                                </Label>
                                <Textarea
                                    id="description"
                                    name="description"
                                    placeholder="What does this store sell?"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={pending}
                            >
                                {pending ? "Creating..." : "Create Store"}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {stores === undefined ? (
                <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2].map((i) => (
                        <Skeleton key={i} className="h-32 rounded-lg" />
                    ))}
                </div>
            ) : stores.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <Store className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium">No stores yet</h3>
                        <p className="text-sm text-muted-foreground mt-1 mb-4">
                            Create your first store to get started.
                        </p>
                        <Button onClick={() => setOpen(true)}>
                            <Plus className="h-4 w-4 mr-2" />
                            Create Store
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {stores.map((store: any) => (
                        <Link key={store._id} href={`/store/${store._id}`}>
                            <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg">
                                            {store.name}
                                        </CardTitle>
                                        <Badge variant="secondary">
                                            {store.role}
                                        </Badge>
                                    </div>
                                    {store.description && (
                                        <CardDescription>
                                            {store.description}
                                        </CardDescription>
                                    )}
                                </CardHeader>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
