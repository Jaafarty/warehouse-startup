# Inventory Import & Edit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship five inventory fixes in a single coherent pass: auto-create categories on import, restock-instead-of-duplicate for known products, working category Select on the edit page, inline category creation from the edit page, and the cost-vs-selling-price import bug.

**Architecture:** Convex mutations do all matching/insertion atomically (no race between "find" and "adjust"). The Next.js client-side import component resolves unknown category names through one batch round-trip before invoking the per-row import. The shared `<NewCategoryDialog>` is extracted from the inventory list page so the product edit page can reuse it.

**Tech Stack:** Convex (mutations + queries, no schema changes), Next.js 16 App Router (client components, server actions), shadcn/ui v4 Dialog/Select, `xlsx` for spreadsheet parsing. The project has no automated test harness — verification is `npx next build` plus manual smoke tests defined per task.

**Spec:** `docs/superpowers/specs/2026-04-27-inventory-import-fixes-design.md`

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/web/convex/categories.ts` | Modify | Add `ensureMany` mutation. |
| `apps/web/convex/products.ts` | Modify | Add `importRow` mutation (match-or-create + stock adjust). |
| `apps/web/app/actions/inventory.ts` | Modify | Add `ensureCategories` action; rewrite `bulkImportProducts` to delegate to `importRow` and return `{ created, updated, failed, errors }`. |
| `apps/web/components/new-category-dialog.tsx` | Create | Shared "+ New Category" dialog component. |
| `apps/web/components/inventory-import-export.tsx` | Modify | Fix `get()` matcher; resolve unknown categories via `ensureCategories`; updated import toast. |
| `apps/web/app/(dashboard)/store/[storeId]/inventory/page.tsx` | Modify | Replace inline category dialog with `<NewCategoryDialog>`. |
| `apps/web/app/(dashboard)/store/[storeId]/inventory/[productId]/page.tsx` | Modify | Controlled Category Select; inline `<NewCategoryDialog>`. |

---

## Task 1: Add `categories.ensureMany` mutation

**Files:**
- Modify: `apps/web/convex/categories.ts`

- [ ] **Step 1: Add the mutation at the bottom of the file**

Append after the existing `remove` export:

```ts
export const ensureMany = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    names: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "inventory",
      "edit"
    );

    const existing = await ctx.db
      .query("categories")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    const byLowerName = new Map<string, any>(
      existing.map((c: any) => [c.name.toLowerCase(), c._id])
    );

    const result: Record<string, any> = {};
    const seen = new Set<string>();

    for (const raw of args.names) {
      const name = raw.trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let id = byLowerName.get(key);
      if (!id) {
        id = await ctx.db.insert("categories", {
          storeId: args.storeId,
          name,
        });
        byLowerName.set(key, id);
      }
      result[key] = id;
    }

    return result;
  },
});
```

- [ ] **Step 2: Verify Convex types compile**

Run from `apps/web`: `npx tsc --noEmit -p convex/tsconfig.json 2>&1 | head -40`

If `convex/tsconfig.json` doesn't exist, run `npx tsc --noEmit` from the repo root and verify there are no new errors in `convex/categories.ts`.

Expected: no errors in `convex/categories.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/categories.ts
git commit -m "Add categories.ensureMany mutation for batched get-or-create"
```

---

## Task 2: Add `products.importRow` mutation

This mutation is the atomic import primitive. It performs SKU → barcode → name matching and either restocks an existing product or creates a new one.

**Files:**
- Modify: `apps/web/convex/products.ts`

- [ ] **Step 1: Add the mutation at the bottom of the file**

Append after the existing `restore` export:

```ts
export const importRow = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    sku: v.optional(v.string()),
    barcode: v.optional(v.string()),
    costPrice: v.number(),
    sellingPrice: v.number(),
    quantity: v.number(),
    lowStockThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "inventory",
      "edit"
    );

    const sku = args.sku?.trim() || undefined;
    const barcode = args.barcode?.trim() || undefined;
    const name = args.name.trim();

    // Match: SKU first
    let match: any = null;
    if (sku) {
      const all = await ctx.db
        .query("products")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
        .collect();
      match = all.find((p: any) => p.sku && p.sku.toLowerCase() === sku.toLowerCase()) ?? null;
    }
    // Then barcode
    if (!match && barcode) {
      match = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q: any) =>
          q.eq("storeId", args.storeId).eq("barcode", barcode)
        )
        .unique();
    }
    // Then name — only when neither side has any identifier
    if (!match && !sku && !barcode) {
      const all = await ctx.db
        .query("products")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
        .collect();
      match = all.find(
        (p: any) =>
          !p.sku && !p.barcode && p.name.toLowerCase() === name.toLowerCase()
      ) ?? null;
    }

    if (match) {
      if (args.quantity > 0) {
        await adjustStock(ctx.db, {
          storeId: args.storeId,
          productId: match._id,
          type: "manual_add",
          quantityChange: args.quantity,
          performedBy: args.userId,
          referenceType: "manual",
          note: "Imported via spreadsheet",
        });
      }

      await createAuditLog(ctx.db, {
        storeId: args.storeId,
        userId: args.userId,
        action: "product_restocked_via_import",
        entityType: "product",
        entityId: match._id,
        details: { addedQuantity: args.quantity, source: "import" },
      });

      return { outcome: "updated" as const, productId: match._id };
    }

    // No match — insert new product (mirrors products.create)
    if (barcode) {
      const dupe = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q: any) =>
          q.eq("storeId", args.storeId).eq("barcode", barcode)
        )
        .unique();
      if (dupe) {
        throw new Error("A product with this barcode already exists");
      }
    }

    const productId = await ctx.db.insert("products", {
      storeId: args.storeId,
      name,
      description: args.description?.trim(),
      categoryId: args.categoryId,
      barcode,
      sku,
      quantity: 0,
      costPrice: args.costPrice,
      sellingPrice: args.sellingPrice,
      lowStockThreshold: args.lowStockThreshold,
      isArchived: false,
      createdBy: args.userId,
      updatedAt: Date.now(),
    });

    if (args.quantity > 0) {
      await adjustStock(ctx.db, {
        storeId: args.storeId,
        productId,
        type: "initial",
        quantityChange: args.quantity,
        performedBy: args.userId,
        note: "Initial stock from import",
      });
    }

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "product_created",
      entityType: "product",
      entityId: productId,
      details: { name, initialQuantity: args.quantity, source: "import" },
    });

    return { outcome: "created" as const, productId };
  },
});
```

- [ ] **Step 2: Verify Convex types compile**

Run from `apps/web`: `npx tsc --noEmit 2>&1 | head -40`

Expected: no new errors in `convex/products.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/products.ts
git commit -m "Add products.importRow mutation: match SKU/barcode/name, restock or create"
```

---

## Task 3: Rewrite `bulkImportProducts` and add `ensureCategories` server action

**Files:**
- Modify: `apps/web/app/actions/inventory.ts`

- [ ] **Step 1: Add `ensureCategories` action above `bulkImportProducts`**

Insert before the existing `bulkImportProducts` export:

```ts
export async function ensureCategories(
  storeId: string,
  names: string[]
): Promise<
  | { success: true; map: Record<string, string> }
  | { success: false; error: string }
> {
  let userId;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const map = await convex.mutation(api.categories.ensureMany, {
      storeId: storeId as any,
      userId,
      names,
    });
    return { success: true, map: map as Record<string, string> };
  } catch (e: any) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Failed to resolve categories",
    };
  }
}
```

- [ ] **Step 2: Replace the body of `bulkImportProducts`**

Replace the entire existing `bulkImportProducts` export with:

```ts
export async function bulkImportProducts(
  storeId: string,
  products: Array<{
    name: string;
    description?: string;
    categoryId?: string;
    sku?: string;
    barcode?: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    lowStockThreshold: number;
  }>
) {
  let userId;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return { success: false, error: "Unauthorized" } as const;
  }

  let created = 0;
  let updated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const product of products) {
    try {
      const result = await convex.mutation(api.products.importRow, {
        storeId: storeId as any,
        userId,
        name: product.name.trim(),
        description: product.description?.trim(),
        categoryId: product.categoryId ? (product.categoryId as any) : undefined,
        sku: product.sku?.trim() || undefined,
        barcode: product.barcode?.trim() || undefined,
        quantity: product.quantity,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        lowStockThreshold: product.lowStockThreshold,
      });
      if (result.outcome === "created") created++;
      else if (result.outcome === "updated") updated++;
    } catch (e: any) {
      failed++;
      errors.push(`"${product.name}": ${e.message}`);
    }
  }

  return { success: true, created, updated, failed, errors } as const;
}
```

- [ ] **Step 3: Verify build still compiles**

From `apps/web`: `npx next build 2>&1 | tail -40`

Expected: build succeeds; no type errors in `app/actions/inventory.ts`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/actions/inventory.ts
git commit -m "Wire bulkImportProducts to importRow; add ensureCategories action"
```

---

## Task 4: Extract `<NewCategoryDialog>` shared component

**Files:**
- Create: `apps/web/components/new-category-dialog.tsx`

- [ ] **Step 1: Create the shared component**

Write the file:

```tsx
"use client";

import { useState, type ReactNode } from "react";
import { createCategory } from "@/app/actions/inventory";
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

interface NewCategoryDialogProps {
  storeId: string;
  triggerLabel: ReactNode;
  triggerClassName?: string;
  onCreated?: (name: string) => void;
}

export function NewCategoryDialog({
  storeId,
  triggerLabel,
  triggerClassName,
  onCreated,
}: NewCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    const name = String(formData.get("name") ?? "").trim();
    const result = await createCategory(storeId, formData);
    setPending(false);
    if (result.success) {
      toast.success("Category created");
      setOpen(false);
      if (name) onCreated?.(name);
    } else {
      toast.error(result.error ?? "Failed to create category");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={triggerClassName}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Category</DialogTitle>
          <DialogDescription>
            Create a product category for this store.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ncd-name">Name</Label>
            <Input
              id="ncd-name"
              name="name"
              placeholder="e.g. Electronics"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ncd-desc">Description (optional)</Label>
            <Input
              id="ncd-desc"
              name="description"
              placeholder="Category description"
            />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Creating..." : "Create Category"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

Trigger pattern: shadcn/ui v4 (`@base-ui/react`) renders `<DialogTrigger>` as a native button by default and forwards `className` to it. This matches the existing usage pattern elsewhere in the codebase (e.g. `inventory/page.tsx` line 162) and avoids any need for `asChild`/`render`-prop semantics.

- [ ] **Step 2: Verify it compiles**

From `apps/web`: `npx tsc --noEmit 2>&1 | head -30`

Expected: no errors in `components/new-category-dialog.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/new-category-dialog.tsx
git commit -m "Add shared NewCategoryDialog component"
```

---

## Task 5: Use `<NewCategoryDialog>` on the inventory list page

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/inventory/page.tsx`

- [ ] **Step 1: Add the import**

Add to the imports block near the top (after the `InventoryImportExport` import, line 25):

```tsx
import { NewCategoryDialog } from "@/components/new-category-dialog";
```

- [ ] **Step 2: Remove the now-unused state and handler**

Delete these lines:
- `import { createCategory, ... } from "@/app/actions/inventory";` — keep `archiveProduct` and `restoreProduct`, drop `createCategory`.
- `const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);`
- `const [categoryPending, setCategoryPending] = useState(false);`
- The entire `async function handleCreateCategory(formData: FormData) { ... }` block.

The import line should become:

```tsx
import {
  archiveProduct,
  restoreProduct,
} from "@/app/actions/inventory";
```

- [ ] **Step 3: Replace the inline `<Dialog>` with `<NewCategoryDialog>`**

Find the existing block starting with `<Dialog open={categoryDialogOpen} ...>` and ending at its closing `</Dialog>` tag (currently lines 158–199). Replace it with:

```tsx
<NewCategoryDialog
  storeId={storeId}
  triggerLabel="+ Category"
  triggerClassName="inline-flex items-center justify-center rounded-lg border px-2.5 h-8 text-sm font-medium hover:bg-muted"
/>
```

- [ ] **Step 4: Verify build still compiles**

From `apps/web`: `npx next build 2>&1 | tail -30`

Expected: build succeeds; the inventory list page renders the same "+ Category" button.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/store/[storeId]/inventory/page.tsx
git commit -m "Use shared NewCategoryDialog on inventory list page"
```

---

## Task 6: Controlled Category Select + inline "+ New" on the edit page

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/inventory/[productId]/page.tsx`

- [ ] **Step 1: Add imports**

Add near the existing imports:

```tsx
import { useEffect } from "react";
import { NewCategoryDialog } from "@/components/new-category-dialog";
```

(`useState` is already imported — leave it.)

- [ ] **Step 2: Add controlled state for the category Select**

Inside `ProductDetailPage`, just below the existing `useQuery(api.categories.list, ...)` call, add:

```tsx
const [categoryId, setCategoryId] = useState<string>("");

useEffect(() => {
  if (product && product.categoryId) {
    setCategoryId(product.categoryId as string);
  } else if (product) {
    setCategoryId("");
  }
}, [product]);
```

- [ ] **Step 3: Replace the Category form field**

Find the existing block (currently lines 322–339):

```tsx
<div className="space-y-2">
  <Label htmlFor="categoryId">Category</Label>
  <Select
    name="categoryId"
    defaultValue={product.categoryId ?? undefined}
  >
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
```

Replace with:

```tsx
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
```

Notes:
- The hidden input keeps the existing `<form action={handleUpdate}>` flow working (it reads `categoryId` from `FormData`).
- The Select itself no longer has `name=` because the hidden input owns the value submitted to the action. shadcn v4's controlled Select reliably renders the matched item's `label`, fixing the "shows the id" bug.
- The `onCreated` callback re-finds the newly created category by name in the (now-refreshed) reactive `categories` list and selects it. Convex subscription latency is typically <100 ms, so by the time the dialog closes the new row is already in `categories`.

- [ ] **Step 4: Verify build still compiles**

From `apps/web`: `npx next build 2>&1 | tail -30`

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/(dashboard)/store/[storeId]/inventory/[productId]/page.tsx
git commit -m "Edit page: controlled category Select + inline NewCategoryDialog"
```

---

## Task 7: Fix import header matcher and resolve unknown categories

This is the biggest single client-side change: it fixes the cost/selling-price bug, sends unknown category names to the new `ensureCategories` action, and surfaces the new "updated" count in the post-import toast.

**Files:**
- Modify: `apps/web/components/inventory-import-export.tsx`

- [ ] **Step 1: Add the `ensureCategories` import**

Replace the existing `import { bulkImportProducts } from "@/app/actions/inventory";` line with:

```tsx
import { bulkImportProducts, ensureCategories } from "@/app/actions/inventory";
```

- [ ] **Step 2: Replace `handleImport()` body**

Replace the entire existing `async function handleImport()` (currently the function starting around line 165 and ending around line 225) with:

```tsx
async function handleImport() {
  if (!parsed.length) return;
  setImporting(true);

  // Strict whole-token header matcher (no substring fallback — that was the
  // source of the cost/selling-price collision).
  const get = (row: Record<string, unknown>, keys: string[]): unknown => {
    for (const k of Object.keys(row)) {
      const norm = k.toLowerCase().replace(/[^a-z]/g, "");
      if (keys.some((t) => norm === t)) return row[k];
    }
    return "";
  };

  type RawRow = {
    name: string;
    description?: string;
    sku?: string;
    barcode?: string;
    categoryName: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    lowStockThreshold: number;
  };

  const raw: RawRow[] = parsed.map((row) => ({
    name: String(get(row, ["name", "productname", "product"])).trim(),
    description:
      String(get(row, ["description", "desc"])).trim() || undefined,
    sku: String(get(row, ["sku"])).trim() || undefined,
    barcode: String(get(row, ["barcode", "ean", "upc"])).trim() || undefined,
    categoryName: String(get(row, ["category"])).trim(),
    costPrice: Number(get(row, ["costprice", "cost"])) || 0,
    sellingPrice:
      Number(
        get(row, ["sellingprice", "sellprice", "saleprice", "salesprice", "price"])
      ) || 0,
    quantity: Math.max(
      0,
      Math.floor(Number(get(row, ["quantity", "qty", "stock"])) || 0)
    ),
    lowStockThreshold: Math.max(
      0,
      Math.floor(
        Number(
          get(row, ["lowstockthreshold", "lowstock", "threshold", "minstock"])
        ) || 5
      )
    ),
  }));

  // Resolve unknown categories in one batch round-trip
  const unknown = Array.from(
    new Set(
      raw
        .map((r) => r.categoryName)
        .filter((n) => n && !categoryByName[n.toLowerCase()])
    )
  );

  let resolved: Record<string, string> = { ...categoryByName };
  if (unknown.length) {
    const ec = await ensureCategories(storeId, unknown);
    if (!ec.success) {
      toast.error(ec.error);
      setImporting(false);
      return;
    }
    resolved = { ...resolved, ...ec.map };
  }

  const mapped = raw.map((r) => ({
    name: r.name,
    description: r.description,
    sku: r.sku,
    barcode: r.barcode,
    categoryId: r.categoryName ? resolved[r.categoryName.toLowerCase()] : undefined,
    costPrice: r.costPrice,
    sellingPrice: r.sellingPrice,
    quantity: r.quantity,
    lowStockThreshold: r.lowStockThreshold,
  }));

  const valid = mapped.filter((p) => p.name && p.sellingPrice > 0);
  const skipped = mapped.length - valid.length;

  if (!valid.length) {
    toast.error("No valid rows found. Name and Selling Price are required.");
    setImporting(false);
    return;
  }

  const result = await bulkImportProducts(storeId, valid);
  setImporting(false);

  if (!result.success) {
    toast.error(result.error ?? "Import failed");
    return;
  }

  const parts: string[] = [];
  if (result.created)
    parts.push(`${result.created} created`);
  if (result.updated)
    parts.push(`${result.updated} restocked`);
  if (skipped)
    parts.push(`${skipped} skipped (missing name/price)`);
  if (result.failed)
    parts.push(`${result.failed} failed`);

  const summary = parts.join(" · ") || "Nothing imported";

  if (result.failed && result.errors?.length) {
    toast.warning(summary, {
      description: result.errors.slice(0, 3).join("\n"),
    });
  } else {
    toast.success(summary);
  }

  setImportOpen(false);
  setParsed([]);
  if (fileRef.current) fileRef.current.value = "";
}
```

Notes:
- The old inline `get` closure captured `row` from the outer `parsed.map((row) => ...)` callback. The replacement passes `row` explicitly, so it can be reused across multiple rows.
- The old code required exact-name matches against existing categories and silently dropped unmatched rows' categories. The new code calls `ensureCategories` for unknowns so they're created and linked.
- `categoryByName` defined at the top of the component is still used as the seed for `resolved`.

- [ ] **Step 3: Update the preview helper text**

Find the existing preview block (currently lines 284–292):

```tsx
{parsed.length > 0 && (
  <div className="rounded-lg border p-3 bg-muted/20 text-sm space-y-1">
    <p className="font-medium">{parsed.length} row{parsed.length !== 1 ? "s" : ""} detected</p>
    <p className="text-muted-foreground text-xs">
      Rows missing Name or Selling Price will be skipped.
      Category must match an existing category name exactly.
    </p>
  </div>
)}
```

Replace with:

```tsx
{parsed.length > 0 && (
  <div className="rounded-lg border p-3 bg-muted/20 text-sm space-y-1">
    <p className="font-medium">
      {parsed.length} row{parsed.length !== 1 ? "s" : ""} detected
    </p>
    <p className="text-muted-foreground text-xs">
      Rows missing Name or Selling Price will be skipped. Unknown categories
      will be created automatically. Existing products (matched by SKU,
      barcode, or name) will be restocked instead of duplicated.
    </p>
  </div>
)}
```

- [ ] **Step 4: Verify build still compiles**

From `apps/web`: `npx next build 2>&1 | tail -30`

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/inventory-import-export.tsx
git commit -m "Import: fix header matcher, auto-create categories, restock existing"
```

---

## Task 8: End-to-end manual smoke test

This task is verification only — no code changes. Skip only if the developer is running headless and cannot start dev servers.

- [ ] **Step 1: Start dev servers**

In two terminals from `apps/web`:

```bash
npx convex dev
```

```bash
npx next dev
```

- [ ] **Step 2: Test the cost/selling price fix**

Build a small `.xlsx` with these columns and one row:

| Name * | Cost Price | Selling Price * | Quantity |
| --- | --- | --- | --- |
| Test Widget A | 4.00 | 9.99 | 10 |

Import via the inventory page. Open the created product. Confirm Cost Price = 4.00 and Selling Price = 9.99 (not equal).

- [ ] **Step 3: Test category auto-create**

Build a sheet with one row whose Category column contains a name that does NOT exist in the store, e.g. `"Brand New Category"`. Import.

Confirm:
- The product appears in the list.
- The "+ Category" dropdown / category filter on the inventory page now lists "Brand New Category".

- [ ] **Step 4: Test restock-instead-of-duplicate**

Re-import the file from Step 2 (same SKU or, if no SKU, same name with no SKU/barcode).

Confirm:
- The toast says `1 restocked` (not `1 created`).
- The product's quantity went from 10 → 20.
- The product's stock history page shows a new `Manual Add` row with note `"Imported via spreadsheet"`.

- [ ] **Step 5: Test edit-page Category Select**

Open any existing product with a category set. Confirm:
- The Category trigger displays the category **name** (not the raw `j5...` id).
- Clicking "+ New" next to the Category label opens the dialog. Create a new category.
- The dialog closes and the Category field auto-selects the newly created category (visible in the trigger).
- Saving the product persists the change.

- [ ] **Step 6: Commit only if any UI tweaks were needed**

If everything passed, no commit. Otherwise note the issue, fix in the appropriate file from Tasks 4–7, and commit.

---

## Final verification

- [ ] **Step 1: Full build**

From `apps/web`: `npx next build`

Expected: 19 routes compile (same as the post-Phase-9 baseline). No new warnings.

- [ ] **Step 2: Update CLAUDE.md if commands or routes changed**

The route count and structure are unchanged. No CLAUDE.md update is required for this work.

- [ ] **Step 3: Confirm git log is clean**

Run `git log --oneline -10`. Expect commits roughly:

```
<sha> Import: fix header matcher, auto-create categories, restock existing
<sha> Edit page: controlled category Select + inline NewCategoryDialog
<sha> Use shared NewCategoryDialog on inventory list page
<sha> Add shared NewCategoryDialog component
<sha> Wire bulkImportProducts to importRow; add ensureCategories action
<sha> Add products.importRow mutation: match SKU/barcode/name, restock or create
<sha> Add categories.ensureMany mutation for batched get-or-create
<sha> Add inventory import & edit fixes design spec
```
