# Inventory Import & Edit Fixes — Design

**Date:** 2026-04-27
**Scope:** Five related fixes around the inventory import flow and the product edit page.

## Problem

1. **Spreadsheet import can't introduce categories.** Rows whose Category column doesn't match an existing category silently lose their category — there's no way to bring new categories in via import.
2. **Re-importing a known product duplicates it.** The current `bulkImportProducts` always creates a new product, so re-importing inventory creates duplicates instead of restocking the existing item. Restocks also don't appear in stock history.
3. **Category Select on the edit page renders the raw `_id`.** On `/store/[storeId]/inventory/[productId]`, the category trigger shows the Convex document id instead of the category name.
4. **No way to add a category from the edit page.** Users have to navigate back to the inventory list to create a category, then return to the product to assign it.
5. **Cost price and selling price end up identical after import.** Every imported product has `costPrice == sellingPrice`. The bug is in the column-name matcher (see Root cause below).

### Root cause for #5

In `apps/web/components/inventory-import-export.tsx`, `handleImport()` defines:

```ts
const get = (keys: string[]) => {
  for (const k of Object.keys(row)) {
    const norm = k.toLowerCase().replace(/[^a-z]/g, "");
    if (keys.some((t) => norm.includes(t))) return row[k];
  }
};
```

For `sellingPrice` it's called with `["sellingprice", "price", "selling"]`. The token `"price"` is a substring of `"costprice"`, so when the spreadsheet has "Cost Price" before "Selling Price" (the template's order), the iteration hits the Cost Price column first and `norm.includes("price")` returns true — so the cost-price value is read for both fields.

## Fixes

### 1. Auto-create unknown categories on import

- New mutation `categories.ensureMany({ storeId, userId, names: string[] })` that, for each name, returns the existing id (case-insensitive lookup against the `by_store_and_name` index) or inserts a new category and returns the new id. Returns `Record<lowercaseName, Id<"categories">>`.
- New server action `ensureCategories(storeId, names[])` in `app/actions/inventory.ts` that wraps the mutation.
- `inventory-import-export.tsx`: after parsing the file, collect every distinct non-empty Category cell that doesn't match an existing category, call `ensureCategories`, then merge the resulting ids into the per-row mapping. Only then call `bulkImportProducts`.

### 2. Match-and-add for existing products

Match strategy (option A from brainstorming): **SKU → barcode → name (case-insensitive)**. The name fallback fires only when the imported row has no SKU and no barcode AND the candidate has no SKU and no barcode — this prevents accidental merges into SKU'd products.

To keep the lookup atomic, fold matching + stock adjustment into a single Convex mutation:

- `products.importRow({ storeId, userId, row })` — performs match by SKU, then barcode, then name (with the no-identifier guard); on hit calls `adjustStock` with `type: "manual_add"`, `note: "Imported via spreadsheet"`; on miss inserts the product (delegates to the same path as `products.create`). Returns `{ outcome: "created" | "updated" | "failed", productId?, error? }`.
- `bulkImportProducts` becomes a thin loop calling `importRow` per row, aggregating `created`, `updated`, `failed`, and errors. **Other fields on a matched product (price, threshold, category, description) are not touched** — only stock is added.
- The toast in `inventory-import-export.tsx` now reads `"X created · Y updated · Z skipped"`.

Imported restocks appear automatically on the existing stock history page because the page already renders `manual_add` rows; the `"Imported via spreadsheet"` note distinguishes them from manual adds.

### 3. Edit-page Category Select shows the name

In `app/(dashboard)/store/[storeId]/inventory/[productId]/page.tsx`, convert the Category Select from uncontrolled (`defaultValue`) to controlled (`value` + `onValueChange`), backed by local state seeded from `product.categoryId` once the product loads. The items already pass `label={cat.name}`, so once the Select is controlled, `<SelectValue>` renders the name correctly.

A hidden `<input type="hidden" name="categoryId" value={selectedCategoryId} />` keeps the form-action path working.

### 4. Inline "+ New Category" on the edit page

Render a small ghost button to the right of the Category label that opens a Dialog identical in shape to the one already used on the inventory list page. On submit it calls the existing `createCategory` server action with the current `storeId`. Convex's reactive `categories.list` query auto-refreshes, and on success we set the Select's controlled value to the newly created category's id.

To avoid duplicating the dialog markup, extract a small `<NewCategoryDialog storeId trigger onCreated />` component under `apps/web/components/` and reuse it from both pages.

### 5. Cost vs selling price import mismatch

Tighten the `get()` matcher in `inventory-import-export.tsx`:

- Match against the **whole** normalised header (`norm === t`) for the primary aliases. Drop the `includes` substring fallback for ambiguous tokens.
- Order alias lists most-specific first so a generic fallback never wins over a specific match. Updated lists:
  - `name`: `["name", "productname", "product"]`
  - `description`: `["description", "desc"]`
  - `sku`: `["sku"]`
  - `barcode`: `["barcode", "ean", "upc"]`
  - `category`: `["category"]`
  - `costPrice`: `["costprice", "cost"]`
  - `sellingPrice`: `["sellingprice", "sellprice", "saleprice", "salesprice", "price"]` — `"price"` is allowed but only matched as a whole word, so it can never match `"costprice"`.
  - `quantity`: `["quantity", "qty", "stock"]`
  - `lowStockThreshold`: `["lowstockthreshold", "lowstock", "threshold", "minstock"]`

Implementation: change `keys.some((t) => norm.includes(t))` → `keys.some((t) => norm === t)`.

## Files touched

- `apps/web/convex/categories.ts` — add `ensureMany` mutation.
- `apps/web/convex/products.ts` — add `importRow` mutation (match + stock adjust OR insert + initial movement).
- `apps/web/app/actions/inventory.ts` — add `ensureCategories`; rewrite `bulkImportProducts` to loop `importRow` and return `{ created, updated, failed, errors }`.
- `apps/web/components/inventory-import-export.tsx` — fix `get()` matcher; resolve unknown categories before import; updated toast.
- `apps/web/app/(dashboard)/store/[storeId]/inventory/[productId]/page.tsx` — controlled Category Select; inline "+ New" button.
- `apps/web/components/new-category-dialog.tsx` (new) — extracted dialog reused by inventory list and edit pages.
- `apps/web/app/(dashboard)/store/[storeId]/inventory/page.tsx` — switch the inline category dialog to the new shared component (small refactor, keeps behaviour identical).

## Out of scope

- No schema changes.
- No changes to import behaviour for archived products (they are still candidates for SKU/barcode match — the existing `by_store_and_barcode` index returns them too).
- No bulk price/threshold updates from import (matched rows only add stock).
- No CSV/XLSX template change beyond the existing column names.

## Verification

- Run `npx next build` from `apps/web` — must pass with the same 19 routes.
- Manual: import a sheet with (a) one new product, (b) one existing product matched by SKU, (c) one row with a category that doesn't exist yet — verify created/updated counts, the new category appears in the categories list, and the existing product's stock history shows a `manual_add` row with the "Imported via spreadsheet" note.
- Manual: open product edit page — Category trigger shows the category name, "+ New" creates and auto-selects a category.
- Manual: import a sheet with distinct cost and selling prices — both columns persist correctly.
