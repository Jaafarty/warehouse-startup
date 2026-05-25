"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  updateProduct,
  archiveProduct,
  restoreProduct,
  adjustProductStock,
} from "@/app/actions/inventory";
import { formatDate } from "@ware-house/shared";
import {
  ArrowLeft,
  Archive,
  RotateCcw,
  History,
  Plus,
  Minus,
  Save,
  Package,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { NewCategoryDialog } from "@/components/new-category-dialog";

export default function ProductDetailPage() {
  const { storeId, productId } = useParams<{
    storeId: string;
    productId: string;
  }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const invFns = store?.effectivePermissions?.inventory?.functions ?? {};
  const catFns = store?.effectivePermissions?.categories?.functions ?? {};
  const can = (fn: string) =>
    isPrivileged || (invFns[fn] ?? false) || (catFns[fn] ?? false);

  const product = useQuery(
    api.products.get,
    userId
      ? { productId: productId as Id<"products">, userId: userId }
      : "skip"
  );

  const categories = useQuery(
    api.categories.list,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );

  const [categoryId, setCategoryId] = useState<string>("");

  useEffect(() => {
    if (product && product.categoryId) {
      setCategoryId(product.categoryId as string);
    } else if (product) {
      setCategoryId("");
    }
  }, [product]);

  const [editPending, setEditPending] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [stockType, setStockType] = useState<"manual_add" | "manual_remove">(
    "manual_add"
  );
  const [stockQty, setStockQty] = useState("");
  const [stockNote, setStockNote] = useState("");
  const [stockPending, setStockPending] = useState(false);

  async function handleUpdate(formData: FormData) {
    setEditPending(true);
    const result = await updateProduct(productId, formData);
    setEditPending(false);
    if (result.success) {
      toast.success("Product updated");
    } else {
      toast.error(result.error ?? "Failed to update");
    }
  }

  async function handleArchive() {
    const result = await archiveProduct(productId);
    if (result.success) {
      toast.success("Product archived");
    } else {
      toast.error(result.error ?? "Failed to archive");
    }
  }

  async function handleRestore() {
    const result = await restoreProduct(productId);
    if (result.success) {
      toast.success("Product restored");
    } else {
      toast.error(result.error ?? "Failed to restore");
    }
  }

  async function handleStockAdjust() {
    const qty = Number(stockQty);
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    if (!product) return;
    if (stockType === "manual_remove" && qty > product.quantity) {
      toast.error(`Cannot remove more than current stock (${product.quantity})`);
      return;
    }
    setStockPending(true);
    const result = await adjustProductStock(
      productId,
      stockType,
      qty,
      stockNote || undefined
    );
    setStockPending(false);
    if (result.success) {
      toast.success("Stock adjusted");
      setStockDialogOpen(false);
      setStockQty("");
      setStockNote("");
    } else {
      toast.error(result.error ?? "Failed to adjust stock");
    }
  }

  if (product === undefined) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
        <Skeleton className="h-16 w-full" />
        <div className="grid gap-5 lg:grid-cols-4">
          <div className="lg:col-span-3 space-y-5">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (product === null) {
    return (
      <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-4">
        <Link href={`/store/${storeId}/inventory`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to inventory
          </Button>
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Product not found.
          </CardContent>
        </Card>
      </div>
    );
  }

  const stockStatus =
    product.quantity === 0 ? (
      <Badge variant="destructive">Out of stock</Badge>
    ) : product.quantity <= product.lowStockThreshold ? (
      <Badge variant="destructive">Low stock</Badge>
    ) : (
      <Badge variant="secondary">In stock</Badge>
    );

  const marginPct = (() => {
    const sell = product.sellingPriceUSD ?? product.sellingPrice;
    const cost = product.costPriceUSD ?? product.costPrice ?? 0;
    if (!sell || sell <= 0) return "—";
    return `${(((sell - cost) / sell) * 100).toFixed(1)}%`;
  })();

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Package}
        title={
          <span className="flex items-center gap-2">
            {product.name}
            {product.isArchived && <Badge variant="outline">Archived</Badge>}
          </span>
        }
        subtitle={`Last updated ${formatDate(product.updatedAt)}`}
        right={
          <>
            {can("view_history") && (
              <Link href={`/store/${storeId}/inventory/${productId}/history`}>
                <Button variant="outline" size="sm">
                  <History className="h-4 w-4 mr-1.5" />
                  History
                </Button>
              </Link>
            )}
            {can("archive_product") &&
              (product.isArchived ? (
                <Button variant="outline" size="sm" onClick={handleRestore}>
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Restore
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={handleArchive}>
                  <Archive className="h-4 w-4 mr-1.5" />
                  Archive
                </Button>
              ))}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        {/* Main: edit form */}
        <div className="lg:col-span-3 space-y-5 min-w-0">
          {can("edit_product") ? (
            <form action={handleUpdate} className="space-y-5">
              <Card>
                <CardHeader>
                  <CardTitle>Product details</CardTitle>
                  <CardDescription>Update product information.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" name="name" defaultValue={product.name} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      name="description"
                      defaultValue={product.description ?? ""}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="categoryId">Category</Label>
                      {can("create_category") && (
                        <NewCategoryDialog
                          storeId={storeId}
                          triggerLabel="+ New"
                          triggerClassName="text-xs font-medium text-muted-foreground hover:text-foreground"
                          onCreated={(name) => {
                            const created = categories?.find(
                              (c) => c.name.toLowerCase() === name.toLowerCase()
                            );
                            if (created) setCategoryId(created._id as string);
                          }}
                        />
                      )}
                    </div>
                    <input type="hidden" name="categoryId" value={categoryId} />
                    <Select
                      value={categoryId}
                      onValueChange={(v) => setCategoryId(v ?? "")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No category">
                          {(value: string | null) => {
                            if (!value) return null;
                            const cat = categories?.find((c) => c._id === value);
                            return cat?.name ?? "…";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem
                            key={cat._id}
                            value={cat._id}
                            label={cat.name}
                          >
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Identification</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU</Label>
                    <Input id="sku" name="sku" defaultValue={product.sku ?? ""} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">Barcode</Label>
                    <Input
                      id="barcode"
                      name="barcode"
                      defaultValue={product.barcode ?? ""}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pricing</CardTitle>
                  <CardDescription>
                    Prices in USD, LBP, or both. At least one selling price is
                    required.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Cost price
                    </Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="costPriceUSD" className="text-xs">
                          USD
                        </Label>
                        <Input
                          id="costPriceUSD"
                          name="costPriceUSD"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          defaultValue={
                            product.costPriceUSD ?? product.costPrice ?? ""
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="costPriceLBP" className="text-xs">
                          LBP
                        </Label>
                        <Input
                          id="costPriceLBP"
                          name="costPriceLBP"
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          defaultValue={product.costPriceLBP ?? ""}
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">
                      Selling price
                    </Label>
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="space-y-2">
                        <Label htmlFor="sellingPriceUSD" className="text-xs">
                          USD
                        </Label>
                        <Input
                          id="sellingPriceUSD"
                          name="sellingPriceUSD"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          defaultValue={
                            product.sellingPriceUSD ?? product.sellingPrice ?? ""
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sellingPriceLBP" className="text-xs">
                          LBP
                        </Label>
                        <Input
                          id="sellingPriceLBP"
                          name="sellingPriceLBP"
                          type="number"
                          step="1"
                          min="0"
                          placeholder="0"
                          defaultValue={product.sellingPriceLBP ?? ""}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lowStockThreshold">Low stock threshold</Label>
                    <Input
                      id="lowStockThreshold"
                      name="lowStockThreshold"
                      type="number"
                      min="0"
                      defaultValue={product.lowStockThreshold}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button type="submit" disabled={editPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {editPending ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Product details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {product.description && (
                  <p className="text-muted-foreground">{product.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">SKU</p>
                    <p>{product.sku || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Barcode</p>
                    <p>{product.barcode || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Aside: stock summary + adjust */}
        <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Stock</CardTitle>
                {can("adjust_stock") && (
                  <Dialog
                    open={stockDialogOpen}
                    onOpenChange={setStockDialogOpen}
                  >
                    <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary px-2.5 h-7 text-xs font-medium text-primary-foreground hover:bg-primary/80">
                      Adjust
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adjust stock</DialogTitle>
                        <DialogDescription>
                          Add or remove stock for {product.name}.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <Button
                            variant={
                              stockType === "manual_add" ? "default" : "outline"
                            }
                            className="flex-1"
                            onClick={() => setStockType("manual_add")}
                            type="button"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                          <Button
                            variant={
                              stockType === "manual_remove"
                                ? "default"
                                : "outline"
                            }
                            className="flex-1"
                            onClick={() => setStockType("manual_remove")}
                            type="button"
                          >
                            <Minus className="h-4 w-4 mr-1" />
                            Remove
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label>Quantity</Label>
                          <Input
                            type="number"
                            min="1"
                            {...(stockType === "manual_remove" && {
                              max: product.quantity,
                            })}
                            value={stockQty}
                            onChange={(e) => setStockQty(e.target.value)}
                            placeholder="Enter quantity"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Note (optional)</Label>
                          <Input
                            value={stockNote}
                            onChange={(e) => setStockNote(e.target.value)}
                            placeholder="Reason for adjustment"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={handleStockAdjust}
                          disabled={stockPending}
                        >
                          {stockPending ? "Adjusting…" : "Confirm"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground">Current quantity</p>
                <p className="text-3xl font-bold mt-0.5">{product.quantity}</p>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">Status</span>
                {stockStatus}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Low stock threshold
                </span>
                <span className="font-medium">{product.lowStockThreshold}</span>
              </div>
              <div className="flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">
                  Margin (USD)
                </span>
                <span className="font-medium">{marginPct}</span>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
