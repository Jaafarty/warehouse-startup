"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { createProduct } from "@/app/actions/inventory";
import { ArrowLeft } from "lucide-react";
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

export default function NewProductPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const categories = useQuery(
    api.categories.list,
    userId ? { storeId: storeId as any, userId: userId as any } : "skip"
  );

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState("");

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createProduct(storeId, formData);
    setPending(false);
    if (result && !result.success) {
      setError(result.error ?? "Failed to create product");
      toast.error(result.error ?? "Failed to create product");
    }
    // On success, createProduct redirects to the product detail page
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/inventory`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add Product</h1>
          <p className="text-muted-foreground">
            Create a new product in your inventory.
          </p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

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
              <Label htmlFor="categoryId">Category</Label>
              <Select name="categoryId" value={categoryId} onValueChange={(v) => setCategoryId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category">
                    {(value: string) => value ? (categories?.find((c: any) => c._id === value)?.name ?? value) : "Select a category"}
                  </SelectValue>
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
            <CardDescription>SKU and barcode (optional).</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" name="sku" placeholder="e.g. PROD-001" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" name="barcode" placeholder="e.g. 123456789" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pricing</CardTitle>
            <CardDescription>
              Enter prices in USD, LBP, or both. At least one selling price is
              required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm text-muted-foreground">Cost Price</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="costPriceUSD" className="text-xs">USD</Label>
                  <Input
                    id="costPriceUSD"
                    name="costPriceUSD"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPriceLBP" className="text-xs">LBP</Label>
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
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="space-y-2">
                  <Label htmlFor="sellingPriceUSD" className="text-xs">USD</Label>
                  <Input
                    id="sellingPriceUSD"
                    name="sellingPriceUSD"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sellingPriceLBP" className="text-xs">LBP</Label>
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
                Leave a side empty if you don't want to fix that currency. The
                sale screen converts using the current exchange rate.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stock</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Initial Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                min="0"
                defaultValue="0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lowStockThreshold">Low Stock Threshold</Label>
              <Input
                id="lowStockThreshold"
                name="lowStockThreshold"
                type="number"
                min="0"
                defaultValue="5"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Link href={`/store/${storeId}/inventory`}>
            <Button variant="outline" type="button">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
