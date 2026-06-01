"use client";

import * as React from "react";
import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  archiveProduct,
  restoreProduct,
} from "@/app/actions/inventory";
import { formatCurrency } from "@ware-house/shared";
import {
  Plus,
  Search,
  MoreHorizontal,
  Archive,
  RotateCcw,
  Eye,
  History,
  Package,
  PackageX,
  AlertTriangle,
} from "lucide-react";
import { InventoryImportExport } from "@/components/inventory-import-export";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function PriceCell({ usd, lbp }: { usd?: number; lbp?: number }) {
  if (usd === undefined && lbp === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="text-right text-sm leading-tight">
      {usd !== undefined && <div>{formatCurrency(usd, "USD")}</div>}
      {lbp !== undefined && (
        <div className="text-xs text-muted-foreground">
          {formatCurrency(lbp, "LBP")}
        </div>
      )}
    </div>
  );
}

export default function InventoryPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(api.stores.getById, userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip");
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const invFns = store?.effectivePermissions?.inventory?.functions ?? {};
  const can = (fn: string) => isPrivileged || (invFns[fn] ?? false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [stockFilter, setStockFilter] = useState<"all" | "low" | "out">("all");
  const products = useQuery(
    api.products.list,
    userId
      ? {
          storeId: storeId as Id<"stores">,
          userId: userId,
          categoryId:
            categoryFilter !== "all" ? (categoryFilter as Id<"categories">) : undefined,
          includeArchived: showArchived,
          search: search || undefined,
        }
      : "skip"
  );

  const filteredProducts = React.useMemo(() => {
    if (!products) return products;
    if (stockFilter === "all") return products;
    return products.filter((p: { quantity?: number; lowStockThreshold?: number }) => {
      const qty = p.quantity ?? 0;
      const threshold = p.lowStockThreshold ?? 0;
      if (stockFilter === "out") return qty <= 0;
      // low: in stock but at/below threshold (skip threshold=0 to avoid noise)
      return qty > 0 && threshold > 0 && qty <= threshold;
    });
  }, [products, stockFilter]);

  const categories = useQuery(
    api.categories.list,
    userId
      ? { storeId: storeId as Id<"stores">, userId }
      : "skip"
  );

  async function handleArchive(productId: string) {
    const result = await archiveProduct(productId);
    if (result.success) {
      toast.success("Product archived");
    } else {
      toast.error(result.error ?? "Failed to archive");
    }
  }

  async function handleRestore(productId: string) {
    const result = await restoreProduct(productId);
    if (result.success) {
      toast.success("Product restored");
    } else {
      toast.error(result.error ?? "Failed to restore");
    }
  }

  const lowStockCount =
    products?.filter(
      (p) => !p.isArchived && p.quantity <= p.lowStockThreshold
    ).length ?? 0;

  const totalProducts =
    products?.filter((p) => !p.isArchived).length ?? 0;

  return (
    <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
      <PageHeader
        icon={Package}
        title="Inventory"
        subtitle={
          <>
            {totalProducts} product{totalProducts !== 1 ? "s" : ""}
            {lowStockCount > 0 && (
              <span className="text-destructive ml-2 font-medium">
                · {lowStockCount} low stock
              </span>
            )}
          </>
        }
        right={
          <>
            {(can("import_products") || can("export_products")) && (
              <InventoryImportExport
                storeId={storeId}
                categories={categories ?? []}
                products={products ?? []}
                canImport={can("import_products")}
                canExport={can("export_products")}
              />
            )}
            {can("add_product") && (
              <Link href={`/store/${storeId}/inventory/new`}>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </Link>
            )}
          </>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="All categories">
              {(value: string) => !value || value === "all" ? "All categories" : (categories?.find((cat) => cat._id === value)?.name ?? value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((cat) => (
              <SelectItem key={cat._id} value={cat._id} label={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={stockFilter}
          onValueChange={(v) => setStockFilter((v ?? "all") as "all" | "low" | "out")}
        >
          <SelectTrigger className="w-full sm:w-[170px]">
            <SelectValue placeholder="All stock">
              {(value: string) =>
                value === "low"
                  ? "Low stock"
                  : value === "out"
                  ? "Out of stock"
                  : "All stock"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stock</SelectItem>
            <SelectItem value="low" label="Low stock">
              <span className="inline-flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                Low stock
              </span>
            </SelectItem>
            <SelectItem value="out" label="Out of stock">
              <span className="inline-flex items-center gap-2">
                <PackageX className="h-3.5 w-3.5 text-destructive" />
                Out of stock
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
          className="w-full sm:w-auto"
        >
          <Archive className="h-4 w-4 mr-1" />
          {showArchived ? "Showing Archived" : "Show Archived"}
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts === undefined ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {search || categoryFilter !== "all" || stockFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Add your first product to get started."}
              </p>
              {!search && categoryFilter === "all" && stockFilter === "all" && (
                <Link href={`/store/${storeId}/inventory/new`}>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Product
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product._id}>
                    <TableCell>
                      <Link
                        href={`/store/${storeId}/inventory/${product._id}`}
                        className="font-medium hover:underline"
                      >
                        {product.name}
                      </Link>
                      {product.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {product.description}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.sku || "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {product.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      <PriceCell
                        usd={product.costPriceUSD ?? product.costPrice}
                        lbp={product.costPriceLBP}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <PriceCell
                        usd={product.sellingPriceUSD ?? product.sellingPrice}
                        lbp={product.sellingPriceLBP}
                      />
                    </TableCell>
                    <TableCell>
                      {product.isArchived ? (
                        <Badge variant="outline">Archived</Badge>
                      ) : product.quantity === 0 ? (
                        <Badge variant="destructive">Out of Stock</Badge>
                      ) : product.quantity <= product.lowStockThreshold ? (
                        <Badge variant="destructive">Low Stock</Badge>
                      ) : (
                        <Badge variant="secondary">In Stock</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-lg size-8 hover:bg-muted">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() =>
                              (window.location.href = `/store/${storeId}/inventory/${product._id}`)
                            }
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {can("view_history") && (
                            <DropdownMenuItem
                              onClick={() =>
                                (window.location.href = `/store/${storeId}/inventory/${product._id}/history`)
                              }
                            >
                              <History className="h-4 w-4 mr-2" />
                              Stock History
                            </DropdownMenuItem>
                          )}
                          {can("archive_product") && (
                            <>
                              <DropdownMenuSeparator />
                              {product.isArchived ? (
                                <DropdownMenuItem onClick={() => handleRestore(product._id)}>
                                  <RotateCcw className="h-4 w-4 mr-2" />
                                  Restore
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() => handleArchive(product._id)}
                                  className="text-destructive"
                                >
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
