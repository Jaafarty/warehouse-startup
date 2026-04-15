"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { createSale } from "@/app/actions/sales";
import { formatCurrency } from "@ware-house/shared";
import { ArrowLeft, Plus, Trash2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface CartItem {
  productId: string;
  name: string;
  sellingPrice: number;
  quantity: number;
  maxQuantity: number;
}

export default function NewSalePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { data: session } = useSession();
  const userId = session?.user?.id;

  const products = useQuery(
    api.products.list,
    userId
      ? {
          storeId: storeId as any,
          userId: userId as any,
          includeArchived: false,
        }
      : "skip"
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addToCart() {
    if (!selectedProduct || !products) return;

    const product = products.find((p: any) => p._id === selectedProduct);
    if (!product) return;

    if (product.quantity <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    const existing = cart.find((i) => i.productId === selectedProduct);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        toast.error(`Only ${product.quantity} available`);
        return;
      }
      setCart(
        cart.map((i) =>
          i.productId === selectedProduct
            ? { ...i, quantity: i.quantity + 1 }
            : i
        )
      );
    } else {
      setCart([
        ...cart,
        {
          productId: product._id,
          name: product.name,
          sellingPrice: product.sellingPrice,
          quantity: 1,
          maxQuantity: product.quantity,
        },
      ]);
    }
    setSelectedProduct("");
  }

  function updateQuantity(productId: string, qty: number) {
    if (qty <= 0) {
      setCart(cart.filter((i) => i.productId !== productId));
      return;
    }
    setCart(
      cart.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(qty, i.maxQuantity) }
          : i
      )
    );
  }

  function removeItem(productId: string) {
    setCart(cart.filter((i) => i.productId !== productId));
  }

  const total = cart.reduce((sum, i) => sum + i.sellingPrice * i.quantity, 0);

  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    setPending(true);
    setError(null);
    const result = await createSale(
      storeId,
      cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      note || undefined
    );
    setPending(false);
    if (result && !result.success) {
      setError(result.error ?? "Failed to create sale");
      toast.error(result.error ?? "Failed to create sale");
    }
    // On success, createSale redirects to the sale detail page
  }

  const availableProducts = products?.filter(
    (p: any) => p.quantity > 0 && !p.isArchived
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/sales`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">New Sale</h1>
          <p className="text-muted-foreground">
            Select products and quantities.
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Product Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Add Products</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Select value={selectedProduct} onValueChange={(v) => setSelectedProduct(v ?? "")}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select a product" />
              </SelectTrigger>
              <SelectContent>
                {availableProducts?.map((p: any) => (
                  <SelectItem key={p._id} value={p._id}>
                    {p.name} — {formatCurrency(p.sellingPrice)} ({p.quantity} in stock)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addToCart} disabled={!selectedProduct}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Cart */}
      <Card>
        <CardHeader>
          <CardTitle>Cart ({cart.length} items)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <ShoppingCart className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                No items added yet.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="w-32">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item) => (
                  <TableRow key={item.productId}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.sellingPrice)}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={1}
                        max={item.maxQuantity}
                        value={item.quantity}
                        onChange={(e) =>
                          updateQuantity(item.productId, Number(e.target.value))
                        }
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(item.sellingPrice * item.quantity)}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.productId)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="text-right font-bold">
                    Total
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    {formatCurrency(total)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Note */}
      <div className="space-y-2">
        <Label>Note (optional)</Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this sale"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Link href={`/store/${storeId}/sales`}>
          <Button variant="outline">Cancel</Button>
        </Link>
        <Button onClick={handleSubmit} disabled={pending || cart.length === 0}>
          {pending ? "Processing..." : `Complete Sale — ${formatCurrency(total)}`}
        </Button>
      </div>
    </div>
  );
}
