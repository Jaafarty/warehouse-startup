"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { createSale } from "@/app/actions/sales";
import { formatCurrency } from "@ware-house/shared";
import { ArrowLeft, Plus, Trash2, ShoppingCart, Search } from "lucide-react";
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
import { CustomerPicker, SelectedCustomer } from "@/components/customer-picker";

type Currency = "USD" | "LBP";

interface CartItem {
  productId: string;
  name: string;
  categoryName?: string;
  sellingPriceUSD?: number;
  sellingPriceLBP?: number;
  currency: Currency;
  quantity: number;
  maxQuantity: number;
}

function unitPriceFor(item: CartItem, rate: number): number {
  if (item.currency === "USD") {
    if (item.sellingPriceUSD !== undefined) return item.sellingPriceUSD;
    if (item.sellingPriceLBP !== undefined) return item.sellingPriceLBP / rate;
    return 0;
  }
  if (item.sellingPriceLBP !== undefined) return item.sellingPriceLBP;
  if (item.sellingPriceUSD !== undefined) return item.sellingPriceUSD * rate;
  return 0;
}

function unitPriceUSDFor(item: CartItem, rate: number): number {
  const native = unitPriceFor(item, rate);
  return item.currency === "USD" ? native : native / rate;
}

export default function NewSalePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const products = useQuery(
    api.products.list,
    userId
      ? {
          storeId: storeId as Id<"stores">,
          userId: userId,
          includeArchived: false,
        }
      : "skip"
  );

  const categories = useQuery(
    api.categories.list,
    userId
      ? { storeId: storeId as Id<"stores">, userId }
      : "skip"
  );
  const categoryName = (id?: Id<"categories">) =>
    id ? categories?.find((c) => c._id === id)?.name : undefined;

  const rateRow = useQuery(
    api.exchangeRates.getCurrent,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );
  const rate = rateRow?.rate ?? 1;

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const canViewExchangeRate =
    isPrivileged ||
    (store?.effectivePermissions?.exchange_rate?.functions?.view_list ?? false);

  const activeShift = useQuery(
    api.shifts.getActive,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const shiftsEnabled = store?.shiftsEnabled === true;
  const shiftsBlocking = shiftsEnabled && activeShift === null;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
  const [paidUSDStr, setPaidUSDStr] = useState("");
  const [paidLBPStr, setPaidLBPStr] = useState("");

  const paidUSD = Number(paidUSDStr) || 0;
  const paidLBP = Number(paidLBPStr) || 0;

  function defaultCurrencyFor(p: { sellingPriceUSD?: number; sellingPrice?: number; sellingPriceLBP?: number }): Currency {
    const usd = p.sellingPriceUSD ?? p.sellingPrice;
    const lbp = p.sellingPriceLBP;
    if (usd !== undefined && lbp === undefined) return "USD";
    if (lbp !== undefined && usd === undefined) return "LBP";
    return "USD";
  }

  function addToCart(productId: string) {
    if (!products) return;

    const product = products.find((p) => p._id === productId);
    if (!product) return;

    if (product.quantity <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }

    const existing = cart.find((i) => i.productId === productId);
    if (existing) {
      if (existing.quantity >= product.quantity) {
        toast.error(`Only ${product.quantity} available`);
        return;
      }
      setCart(
        cart.map((i) =>
          i.productId === productId
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
          categoryName: categoryName(product.categoryId),
          sellingPriceUSD: product.sellingPriceUSD ?? product.sellingPrice,
          sellingPriceLBP: product.sellingPriceLBP,
          currency: defaultCurrencyFor(product),
          quantity: 1,
          maxQuantity: product.quantity,
        },
      ]);
    }
    setProductSearch("");
  }

  function updateQuantity(productId: string, qty: number) {
    // Keep the row even when qty is cleared/zero so the user can edit it.
    // The Complete Sale button is gated on a positive qty per row.
    const safe = Number.isFinite(qty) && qty > 0 ? qty : 0;
    setCart(
      cart.map((i) =>
        i.productId === productId
          ? { ...i, quantity: Math.min(safe, i.maxQuantity) }
          : i
      )
    );
  }

  function updateCurrency(productId: string, currency: Currency) {
    setCart(
      cart.map((i) =>
        i.productId === productId ? { ...i, currency } : i
      )
    );
  }

  function removeItem(productId: string) {
    setCart(cart.filter((i) => i.productId !== productId));
  }

  const totalUSD = cart.reduce(
    (sum, i) => sum + unitPriceUSDFor(i, rate) * i.quantity,
    0
  );
  const totalLBP = totalUSD * rate;
  const tenderedUSD = paidUSD + (rate > 0 ? paidLBP / rate : 0);
  const remainingUSD = totalUSD - tenderedUSD;
  const isCovered = tenderedUSD + 1e-6 >= totalUSD;
  const changeUSD = isCovered ? tenderedUSD - totalUSD : 0;
  const hasInvalidQty = cart.some((i) => i.quantity <= 0);

  async function handleSubmit() {
    if (cart.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    if (hasInvalidQty) {
      toast.error("Each item needs a quantity of at least 1");
      return;
    }
    if (!isCovered) {
      toast.error("Payment does not cover the total");
      return;
    }
    setPending(true);
    setError(null);
    const result = await createSale(
      storeId,
      cart.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
        currency: i.currency,
      })),
      { paidUSD, paidLBP },
      note || undefined,
      customer?._id
    );
    setPending(false);
    if (result && !result.success) {
      setError(result.error ?? "Failed to create sale");
      toast.error(result.error ?? "Failed to create sale");
    }
  }

  const availableProducts = products?.filter(
    (p) => p.quantity > 0 && !p.isArchived
  );

  const productSearchTerm = productSearch.trim().toLowerCase();
  const productMatches = productSearchTerm
    ? availableProducts?.filter((p) => {
        const cat = categoryName(p.categoryId)?.toLowerCase() ?? "";
        return (
          p.name.toLowerCase().includes(productSearchTerm) ||
          p.sku?.toLowerCase().includes(productSearchTerm) ||
          p.barcode?.toLowerCase().includes(productSearchTerm) ||
          cat.includes(productSearchTerm)
        );
      })
    : undefined;

  if (shiftsBlocking) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/store/${storeId}/sales`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">New Sale</h1>
            <p className="text-muted-foreground">
              You need an active shift to record a sale.
            </p>
          </div>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>No active shift</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              This store requires cashiers to open a shift before recording
              sales. Open one to continue.
            </p>
            <Link href={`/store/${storeId}/shifts/new`}>
              <Button>Open shift</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

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

      {/* Rate banner — hide entirely when no rate is set AND user can't manage it */}
      {(rateRow || canViewExchangeRate) &&
        (canViewExchangeRate ? (
          <Link
            href={`/store/${storeId}/exchange-rate`}
            className="block rounded-lg border bg-muted/30 px-4 py-2 text-sm hover:bg-muted/50"
          >
            <span className="text-muted-foreground">Current exchange rate: </span>
            <span className="font-medium">
              1 USD = {rate.toLocaleString()} LBP
            </span>
            {!rateRow && (
              <span className="text-destructive ml-2">
                (no rate set — click to configure)
              </span>
            )}
          </Link>
        ) : (
          <div className="rounded-lg border bg-muted/30 px-4 py-2 text-sm">
            <span className="text-muted-foreground">Current exchange rate: </span>
            <span className="font-medium">
              1 USD = {rate.toLocaleString()} LBP
            </span>
          </div>
        ))}

      <Card>
        <CardHeader>
          <CardTitle>Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomerPicker
            storeId={storeId}
            value={customer}
            onChange={setCustomer}
          />
          <p className="text-xs text-muted-foreground mt-2">
            Optional. Leave empty for a walk-in sale.
          </p>
        </CardContent>
      </Card>

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
        <CardContent className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search by name, SKU, barcode or category"
              className="pl-8"
            />
          </div>

          {productSearchTerm && productMatches && productMatches.length > 0 && (
            <div className="rounded-md border max-h-72 overflow-y-auto divide-y">
              {productMatches.map((p) => {
                const usd = p.sellingPriceUSD ?? p.sellingPrice;
                const lbp = p.sellingPriceLBP;
                const priceLabel = [
                  usd !== undefined ? formatCurrency(usd, "USD") : null,
                  lbp !== undefined ? formatCurrency(lbp, "LBP") : null,
                ]
                  .filter(Boolean)
                  .join(" / ");
                const cat = categoryName(p.categoryId);
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => addToCart(p._id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {p.name}
                        {cat && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({cat})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {priceLabel || "No price set"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {p.quantity} in stock
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {productSearchTerm && productMatches && productMatches.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              No matches.
            </p>
          )}
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
                  <TableHead className="w-28">Currency</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="w-24">Qty</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.map((item) => {
                  const unit = unitPriceFor(item, rate);
                  const isAutoConverted =
                    (item.currency === "USD" &&
                      item.sellingPriceUSD === undefined) ||
                    (item.currency === "LBP" &&
                      item.sellingPriceLBP === undefined);
                  return (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">
                        <div>{item.name}</div>
                        {item.categoryName && (
                          <div className="text-xs text-muted-foreground font-normal">
                            {item.categoryName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={item.currency}
                          onValueChange={(v) =>
                            updateCurrency(
                              item.productId,
                              (v ?? "USD") as Currency
                            )
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue>
                              {(value: string) => value || "USD"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="USD" label="USD">
                              USD
                            </SelectItem>
                            <SelectItem value="LBP" label="LBP">
                              LBP
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={isAutoConverted ? "italic text-muted-foreground" : ""}>
                          {formatCurrency(unit, item.currency)}
                        </span>
                        {isAutoConverted && (
                          <div className="text-xs text-muted-foreground">
                            (converted)
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={item.maxQuantity}
                          value={item.quantity === 0 ? "" : item.quantity}
                          onChange={(e) =>
                            updateQuantity(
                              item.productId,
                              Number(e.target.value)
                            )
                          }
                          className={`w-20 ${
                            item.quantity <= 0 ? "border-destructive" : ""
                          }`}
                        />
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(unit * item.quantity, item.currency)}
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
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Totals + Payment */}
      {cart.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Totals & Payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-3 bg-muted/20">
              <div>
                <p className="text-xs text-muted-foreground">Total (USD)</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalUSD, "USD")}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total (LBP)</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalLBP, "LBP")}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="paidUSD">Paid (USD)</Label>
                <Input
                  id="paidUSD"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paidUSDStr}
                  onChange={(e) => setPaidUSDStr(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="paidLBP">Paid (LBP)</Label>
                <Input
                  id="paidLBP"
                  type="number"
                  step="1"
                  min="0"
                  value={paidLBPStr}
                  onChange={(e) => setPaidLBPStr(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="rounded-lg border p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tendered (USD eq.)</span>
                <span className="font-mono">
                  {formatCurrency(tenderedUSD, "USD")}
                </span>
              </div>
              {isCovered ? (
                <div className="flex justify-between font-medium text-[color:var(--color-success)]">
                  <span>Change due</span>
                  <span className="font-mono">
                    {formatCurrency(changeUSD, "USD")}
                    {" / "}
                    {formatCurrency(changeUSD * rate, "LBP")}
                  </span>
                </div>
              ) : (
                <div className="flex justify-between font-medium text-destructive">
                  <span>Remaining due</span>
                  <span className="font-mono">
                    {formatCurrency(remainingUSD, "USD")}
                    {" / "}
                    {formatCurrency(remainingUSD * rate, "LBP")}
                  </span>
                </div>
              )}
            </div>

            <Button
              size="sm"
              variant="outline"
              type="button"
              onClick={() => {
                // One-click "pay exact in USD" helper
                setPaidUSDStr(totalUSD.toFixed(2));
                setPaidLBPStr("0");
              }}
            >
              Pay exact in USD
            </Button>
          </CardContent>
        </Card>
      )}

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
        <Button
          onClick={handleSubmit}
          disabled={pending || cart.length === 0 || !isCovered || hasInvalidQty}
        >
          {pending
            ? "Processing..."
            : `Complete Sale — ${formatCurrency(totalUSD, "USD")}`}
        </Button>
      </div>
    </div>
  );
}
