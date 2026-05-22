"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { NewCategoryDialog } from "@/components/new-category-dialog";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { createProduct } from "@/app/actions/inventory";
import {
  PackagePlus,
  Tag as TagIcon,
  AlertTriangle,
  TrendingUp,
  Info,
} from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";

export default function NewProductPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const invFns = store?.effectivePermissions?.inventory?.functions ?? {};
  const catFns = store?.effectivePermissions?.categories?.functions ?? {};
  const can = (fn: string) =>
    isPrivileged || (invFns[fn] ?? false) || (catFns[fn] ?? false);

  const categories = useQuery(
    api.categories.list,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Controlled fields powering live Preview
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sellingUSD, setSellingUSD] = useState("");
  const [costUSD, setCostUSD] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");

  const categoryName = useMemo(
    () => categories?.find((c) => c._id === categoryId)?.name,
    [categories, categoryId]
  );

  const margin = useMemo(() => {
    const sell = parseFloat(sellingUSD);
    const cost = parseFloat(costUSD);
    if (!Number.isFinite(sell) || sell <= 0) return null;
    if (!Number.isFinite(cost) || cost <= 0) return null;
    return ((sell - cost) / sell) * 100;
  }, [sellingUSD, costUSD]);

  const qtyNum = parseInt(quantity, 10) || 0;
  const thresholdNum = parseInt(lowStockThreshold, 10) || 0;
  const stockState: "out" | "low" | "ok" =
    qtyNum <= 0 ? "out" : thresholdNum > 0 && qtyNum <= thresholdNum ? "low" : "ok";

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createProduct(storeId, formData);
    setPending(false);
    if (result && !result.success) {
      setError(result.error ?? "Failed to create product");
      toast.error(result.error ?? "Failed to create product");
    }
  }

  return (
    <form action={handleSubmit}>
      <div
        style={{ padding: "var(--wh-density-pad)" }}
        className="space-y-5"
      >
        <PageHeader
          icon={PackagePlus}
          title="Add Product"
          subtitle="Create a new product in your inventory."
          right={
            <>
              <Link href={`/store/${storeId}/inventory`}>
                <Button variant="outline" type="button" size="sm">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? "Creating…" : "Create Product"}
              </Button>
            </>
          }
        />

        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          {/* Main form */}
          <div className="lg:col-span-2 space-y-5 min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Basic Info</CardTitle>
                <CardDescription>
                  Product name, description, and category.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Product name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    placeholder="Optional description"
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
                        onCreated={(createdName) => {
                          const created = categories?.find(
                            (c) =>
                              c.name.toLowerCase() === createdName.toLowerCase()
                          );
                          if (created) setCategoryId(created._id as string);
                        }}
                      />
                    )}
                  </div>
                  <Select
                    name="categoryId"
                    value={categoryId}
                    onValueChange={(v) => setCategoryId(v ?? "")}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a category">
                        {(value: string) =>
                          value
                            ? categories?.find((c) => c._id === value)?.name ??
                              value
                            : "Select a category"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
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
                <CardDescription>SKU and barcode (optional).</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input id="sku" name="sku" placeholder="e.g. PROD-001" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input
                    id="barcode"
                    name="barcode"
                    placeholder="e.g. 123456789"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
                <CardDescription>
                  Enter prices in USD, LBP, or both. At least one selling price
                  is required.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Cost Price
                  </Label>
                  <div className="grid gap-4 sm:grid-cols-2 mt-2">
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
                        value={costUSD}
                        onChange={(e) => setCostUSD(e.target.value)}
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
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">
                    Selling Price *
                  </Label>
                  <div className="grid gap-4 sm:grid-cols-2 mt-2">
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
                        value={sellingUSD}
                        onChange={(e) => setSellingUSD(e.target.value)}
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
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Leave a side empty if you don&apos;t want to fix that
                    currency. The sale screen converts using the current
                    exchange rate.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Stock</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="quantity">Initial Quantity</Label>
                  <Input
                    id="quantity"
                    name="quantity"
                    type="number"
                    min="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
                  <Input
                    id="lowStockThreshold"
                    name="lowStockThreshold"
                    type="number"
                    min="0"
                    value={lowStockThreshold}
                    onChange={(e) => setLowStockThreshold(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right rail — live preview */}
          <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live preview</CardTitle>
                <CardDescription>
                  How this product will appear once saved.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Name
                  </p>
                  <p className="font-semibold text-sm truncate">
                    {name.trim() || "Untitled product"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <TagIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {categoryName ?? "Uncategorized"}
                  </span>
                </div>

                <div className="rounded-lg border p-3 space-y-1.5">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Pricing
                  </p>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-mono">
                      {costUSD ? `$${costUSD}` : "—"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sell</span>
                    <span className="font-mono font-semibold">
                      {sellingUSD ? `$${sellingUSD}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Margin
                    </span>
                    <span
                      className={
                        margin == null
                          ? "text-xs text-muted-foreground"
                          : margin < 0
                          ? "text-xs font-semibold text-destructive"
                          : "text-xs font-semibold text-emerald-600"
                      }
                    >
                      {margin == null ? "—" : `${margin.toFixed(1)}%`}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Stock status
                  </p>
                  {stockState === "out" ? (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      Out of stock at start
                    </div>
                  ) : stockState === "low" ? (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      At or below low threshold
                    </div>
                  ) : (
                    <p className="text-sm">
                      <span className="font-mono font-semibold">
                        {qtyNum}
                      </span>{" "}
                      in stock
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-2">
                <p>
                  Set a low-stock threshold to get notified before you run out.
                </p>
                <p>
                  You can leave one currency empty; the sale screen converts
                  with the current exchange rate.
                </p>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </form>
  );
}
