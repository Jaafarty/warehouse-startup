"use client";

import { useState, useEffect } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import {
  updateProduct,
  archiveProduct,
  restoreProduct,
  adjustProductStock,
} from "@/app/actions/inventory";
import { formatCurrency, formatDate } from "@ware-house/shared";
import {
  ArrowLeft,
  Archive,
  RotateCcw,
  History,
  Plus,
  Minus,
  Save,
} from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { NewCategoryDialog } from "@/components/new-category-dialog";

export default function ProductDetailPage() {
  const { storeId, productId } = useParams<{
    storeId: string;
    productId: string;
  }>();
  const { userId } = useCurrentUser();

  const product = useQuery(
    api.products.get,
    userId
      ? { productId: productId as any, userId: userId as any }
      : "skip"
  );

  const categories = useQuery(
    api.categories.list,
    userId ? { storeId: storeId as any, userId: userId as any } : "skip"
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
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (product === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Product not found.</p>
        <Link href={`/store/${storeId}/inventory`}>
          <Button variant="link" className="px-0 mt-2">
            Back to inventory
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/store/${storeId}/inventory`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{product.name}</h1>
              {product.isArchived && (
                <Badge variant="outline">Archived</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Last updated {formatDate(product.updatedAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/store/${storeId}/inventory/${productId}/history`}>
            <Button variant="outline" size="sm">
              <History className="h-4 w-4 mr-2" />
              History
            </Button>
          </Link>
          {product.isArchived ? (
            <Button variant="outline" size="sm" onClick={handleRestore}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Restore
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleArchive}>
              <Archive className="h-4 w-4 mr-2" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Stock Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Stock</CardTitle>
            <Dialog open={stockDialogOpen} onOpenChange={setStockDialogOpen}>
              <DialogTrigger className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 h-8 text-sm font-medium text-primary-foreground hover:bg-primary/80">
                Adjust Stock
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adjust Stock</DialogTitle>
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
                        stockType === "manual_remove" ? "default" : "outline"
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
                    {stockPending ? "Adjusting..." : "Confirm"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Quantity</p>
              <p className="text-2xl font-bold">{product.quantity}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Threshold</p>
              <p className="text-2xl font-bold">{product.lowStockThreshold}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <div className="mt-1">
                {product.quantity <= product.lowStockThreshold ? (
                  <Badge variant="destructive">Low Stock</Badge>
                ) : (
                  <Badge variant="secondary">In Stock</Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Form */}
      <form action={handleUpdate} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Product Details</CardTitle>
            <CardDescription>Update product information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={product.name}
              />
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
                <NewCategoryDialog
                  storeId={storeId}
                  triggerLabel="+ New"
                  triggerClassName="text-xs font-medium text-muted-foreground hover:text-foreground"
                  onCreated={(name) => {
                    const created = categories?.find(
                      (c: any) => c.name.toLowerCase() === name.toLowerCase()
                    );
                    if (created) setCategoryId(created._id as string);
                  }}
                />
              </div>
              <input type="hidden" name="categoryId" value={categoryId} />
              <Select value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="No category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((cat: any) => (
                    <SelectItem key={cat._id} value={cat._id} label={cat.name}>
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
              <Input
                id="sku"
                name="sku"
                defaultValue={product.sku ?? ""}
              />
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
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="costPrice">Cost Price</Label>
              <Input
                id="costPrice"
                name="costPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={product.costPrice}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sellingPrice">Selling Price</Label>
              <Input
                id="sellingPrice"
                name="sellingPrice"
                type="number"
                step="0.01"
                min="0.01"
                defaultValue={product.sellingPrice}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                type="number"
                min="0"
                defaultValue={product.lowStockThreshold}
              />
            </div>
            <div className="space-y-2">
              <Label>Margin</Label>
              <p className="text-sm text-muted-foreground mt-2">
                {product.sellingPrice > 0
                  ? `${(((product.sellingPrice - product.costPrice) / product.sellingPrice) * 100).toFixed(1)}%`
                  : "—"}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" disabled={editPending}>
            <Save className="h-4 w-4 mr-2" />
            {editPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
