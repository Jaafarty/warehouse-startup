"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
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
} from "lucide-react";
import { InventoryImportExport } from "@/components/inventory-import-export";
import { NewCategoryDialog } from "@/components/new-category-dialog";
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

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const products = useQuery(
    api.products.list,
    userId
      ? {
          storeId: storeId as any,
          userId: userId as any,
          categoryId:
            categoryFilter !== "all" ? (categoryFilter as any) : undefined,
          includeArchived: showArchived,
          search: search || undefined,
        }
      : "skip"
  );

  const categories = useQuery(
    api.categories.list,
    userId
      ? { storeId: storeId as any, userId: userId as any }
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
      (p: any) => !p.isArchived && p.quantity <= p.lowStockThreshold
    ).length ?? 0;

  const totalProducts =
    products?.filter((p: any) => !p.isArchived).length ?? 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground">
            {totalProducts} product{totalProducts !== 1 ? "s" : ""}
            {lowStockCount > 0 && (
              <span className="text-destructive ml-2">
                ({lowStockCount} low stock)
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InventoryImportExport
            storeId={storeId}
            categories={categories ?? []}
            products={products ?? []}
          />
          <NewCategoryDialog
            storeId={storeId}
            triggerLabel="+ Category"
            triggerClassName="inline-flex items-center justify-center rounded-lg border px-2.5 h-8 text-sm font-medium hover:bg-muted"
          />
          <Link href={`/store/${storeId}/inventory/new`}>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v ?? "all")}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All categories">
              {(value: string) => !value || value === "all" ? "All categories" : (categories?.find((cat: any) => cat._id === value)?.name ?? value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories?.map((cat: any) => (
              <SelectItem key={cat._id} value={cat._id} label={cat.name}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant={showArchived ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          <Archive className="h-4 w-4 mr-1" />
          {showArchived ? "Showing Archived" : "Show Archived"}
        </Button>
      </div>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          {products === undefined ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No products found</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                {search || categoryFilter !== "all"
                  ? "Try adjusting your filters."
                  : "Add your first product to get started."}
              </p>
              {!search && categoryFilter === "all" && (
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
                {products.map((product: any) => (
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
                          <DropdownMenuItem
                            onClick={() =>
                              (window.location.href = `/store/${storeId}/inventory/${product._id}/history`)
                            }
                          >
                            <History className="h-4 w-4 mr-2" />
                            Stock History
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {product.isArchived ? (
                            <DropdownMenuItem
                              onClick={() => handleRestore(product._id)}
                            >
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
