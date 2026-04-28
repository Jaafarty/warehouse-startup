# Customer-Linked Sales & Returns — Design

**Date:** 2026-04-28
**Status:** Design approved, awaiting implementation plan

## Problem

Today the sales flow has three gaps:

1. **No customer attached to sales.** A sale records who *processed* it (`createdBy`) but not *for whom*. Staff can't search past sales by the buyer's name or phone.
2. **Returns are not first-class records.** The current `returnItems` mutation patches `saleItems.returnedQuantity` and flips `sale.status`, but produces no discrete "return" entity — there's no return number, no per-return refund total, no list view, and no separate audit row for "this person returned X on this date."
3. **Return UX is a small modal with a quantity input.** Users want to "edit the receipt": pick which lines to return via checkboxes (with a partial-quantity escape hatch), pick a reason, and save.

## Goals

- Every sale can be linked to a customer (name + phone). Customers are reusable across sales.
- Sales list is searchable by sale number, customer name, or phone.
- Returns are recorded as their own records (`saleReturns` + `saleReturnItems`), each with its own number, date, reason, and refund total.
- Returns are processed via a dedicated page (not a modal), with checkbox-driven line selection and a preset reason dropdown.
- Returns are visible in two places: (a) on each sale's detail page (history section); (b) a new store-wide returns page.

## Non-goals

- Customer profiles with history/spend dashboards. Just storage + search.
- Editing or deleting returns (immutable once created).
- Undoing a return (would require its own flow).
- Backfilling old `returnedQuantity` patches into synthetic `saleReturns` records.
- Email/address/notes on customers (just name + phone).
- Required customers (walk-in sales remain valid).

## Schema

### New table: `customers`

| field | type | notes |
| --- | --- | --- |
| `storeId` | `Id<"stores">` | scoping |
| `name` | `string` | display name |
| `phone` | `string` | dedupe key within a store |
| `createdBy` | `Id<"users">` | |
| `createdAt` | `number` | |
| `updatedAt` | `number` | |

Indexes:
- `by_store_and_phone` — used to dedupe on create and to look up an existing customer
- `by_store_and_name` — used by the customer search combobox

### `sales` — add field

- `customerId?: Id<"customers">` — optional. Unset = walk-in.
- New index: `by_store_and_customer` (used to list a customer's sales later if needed; no UI for it in this spec).

### New table: `saleReturns`

| field | type | notes |
| --- | --- | --- |
| `storeId` | `Id<"stores">` | |
| `saleId` | `Id<"sales">` | original sale |
| `returnNumber` | `string` | format `R-YYYYMMDD-XXXX` |
| `reason` | union of literals | `defective` \| `wrong_item` \| `damaged_in_transit` \| `customer_changed_mind` \| `other` |
| `note` | `string?` | required iff `reason === "other"` |
| `totalRefund` | `number` | sum of `unitPrice * quantity` of returned items |
| `itemCount` | `number` | total returned units |
| `createdBy` | `Id<"users">` | who processed it |
| `createdAt` | `number` | |

Indexes:
- `by_store_and_date`
- `by_sale`

### New table: `saleReturnItems`

| field | type | notes |
| --- | --- | --- |
| `returnId` | `Id<"saleReturns">` | parent |
| `saleItemId` | `Id<"saleItems">` | original line |
| `productId` | `Id<"products">` | denormalized for queries |
| `productName` | `string` | frozen at return time |
| `quantity` | `number` | returned units in this return |
| `unitPrice` | `number` | frozen at return time |
| `totalRefund` | `number` | `quantity * unitPrice` |

Indexes:
- `by_return`
- `by_sale_item`

### `saleItems.returnedQuantity` stays

Kept as the running total across all returns for that line. It remains the source of truth for "how many units of this line are still returnable" (`quantity − returnedQuantity`).

## Convex functions

### New `convex/customers.ts`

- `list({ storeId, userId, search? })` — returns customers in the store; if `search` is provided, filters by name OR phone (case-insensitive substring). Permission: reuse the existing `sales` scope (`sales:view`) — customers are sales-adjacent and don't warrant a separate permission.
- `getByPhone({ storeId, phone, userId })` — returns the customer whose `(storeId, phone)` matches, or null. Used by the new-customer dialog to dedupe.
- `create({ storeId, userId, name, phone })` — throws if a customer with this phone already exists in the store. Returns the new id.

### `convex/sales.ts` changes

- `create` — adds optional `customerId`; validates the customer belongs to `storeId` when provided.
- `list` — adds optional `search`. Filters by sale number, customer name, or phone. Resolves `customerName` + `customerPhone` server-side per row (single batched read of the customer cache, similar to the existing `userCache`).
- `get` — returns the resolved `customer` object alongside the sale (null if walk-in).
- `returnItems` — **removed**. The new return page calls `returns.create` instead.

### New `convex/returns.ts`

- `listByStore({ storeId, userId, search?, reason?, dateRange? })`
  - `search` matches return number, sale number, customer name, or phone
  - `reason` matches the reason literal
  - `dateRange` optional `{ from, to }` epoch ms
  - resolves `saleNumber`, `customerName`, `processedByName` server-side
- `getBySale({ saleId, userId })` — list returns belonging to a single sale (for the "Returns history" section on the sale detail page)
- `get({ returnId, userId })` — full return detail with items and resolved sale + customer
- `create({ saleId, userId, items, reason, note? })`:
  1. Permission: `sales:edit`
  2. Validates: each `item.quantity > 0` and `≤ saleItem.quantity − saleItem.returnedQuantity`
  3. Validates: `note` non-empty when `reason === "other"`
  4. Generates `returnNumber` (`R-YYYYMMDD-XXXX`)
  5. Inserts `saleReturns` row (totals computed from frozen `unitPrice`s)
  6. Inserts `saleReturnItems` rows (one per returned line)
  7. Patches each `saleItems.returnedQuantity` (running total)
  8. Patches `sales.status` → `partially_returned` or `returned` based on whether every line is fully returned
  9. Calls `adjustStock(type: "return", referenceType: "sale_return", referenceId: returnId)` per line — uses the **new return's id**, not the sale's, so stock-history rows trace back to the specific return
  10. Audit log: `action: "sale_return"`, `entityType: "saleReturn"`, `entityId: returnId`

### Server actions

- New `apps/web/app/actions/customers.ts`: `createCustomer({ storeId, name, phone })`
- `apps/web/app/actions/sales.ts`: `createSale` gains `customerId?: Id<"customers">`
- New `apps/web/app/actions/returns.ts`: `createReturn({ saleId, items, reason, note? })`

## UI

### New sale page (`/store/[storeId]/sales/new`)

- New **Customer** section above the cart:
  - Search input that filters the customer list as you type (matches name OR phone). Results render as a list below the input with name + phone.
  - "+ New customer" button opens a dialog (name + phone). Phone is validated as non-empty; on submit, calls `createCustomer` then auto-selects.
  - Selected customer renders as a chip with a clear (×) button.
  - Empty state = walk-in. No special toggle needed.

### Sales list page (`/store/[storeId]/sales`)

- Add a search input above the table — debounced, calls `sales.list({ search })` on change.
- Add a "Customer" column showing name (or "—" for walk-ins).
- Existing status filter stays.

### Sale detail page (`/store/[storeId]/sales/[saleId]`)

- Add a **Customer** card to the summary grid (next to Total / Items / Status). Shows name + phone, or "Walk-in" if `customerId` is unset.
- Replace the inline "Process Return" Dialog with a **link button** that navigates to `/store/[storeId]/sales/[saleId]/return`.
- Add a **"Returns history"** section below the line items: table of every `saleReturns` row for this sale — return number (link), date, reason, total refund, processed-by. Empty state when none exist.

### New return page (`/store/[storeId]/sales/[saleId]/return`)

- Header: "Process Return — `<sale number>`", breadcrumb back to the sale.
- Card: "Items to return". Table with one row per `saleItem`:
  - Product name + sold qty + already-returned qty (info)
  - "Return this item" checkbox
  - When checked: a number input appears, defaulted to the remaining returnable qty (`quantity − returnedQuantity`); user can edit down. Max-clamped on the client.
  - Fully-returned lines render but the checkbox is disabled.
- Card: "Reason". Dropdown with the 5 options. Note textarea below; label and validation switch to "Note (required)" when reason = `other`.
- Live "Refund total" summary at the bottom.
- "Save return" button → calls `createReturn` → toast on success → redirects to `/store/[storeId]/returns/[returnId]`.

### New returns list page (`/store/[storeId]/returns`)

- Table columns: return number (link), date, sale number (link), customer, reason, total refund, processed-by.
- Search input (return number, sale number, customer name/phone) — debounced.
- Reason filter dropdown.
- Date range filter — simple `from` / `to` date inputs.

### New return detail page (`/store/[storeId]/returns/[returnId]`)

- Summary cards: return number, date, reason, total refund, processed-by, link to original sale, customer (or "Walk-in").
- Line items table: product, qty returned, unit price, refund.
- If `note` present, render below summary.
- Read-only — returns are immutable.

### Sidebar

Add a **"Returns"** link in the store sidebar under "Sales", with an appropriate icon (`Undo2` / `RotateCcw`).

## Migration notes

- `customers` is a brand-new table — no migration.
- `sales.customerId` is optional — existing sales validate without backfill.
- `saleReturns` / `saleReturnItems` are new — no migration.
- `saleItems.returnedQuantity` semantics are unchanged.
- Old per-line "returnedQuantity" patches (from the deprecated `returnItems` mutation) stay as-is. Those returns simply don't appear on the new returns page (they have no `saleReturns` row). Acceptable because there's no real production data yet.
- Audit log `action: "sale_return"` already exists; the new mutation reuses it but with `entityType: "saleReturn"` and `entityId: returnId` instead of pointing at the sale.

## Route map

3 new routes (22 total after this feature):

```
/store/[storeId]/sales/[saleId]/return     — process return form
/store/[storeId]/returns                   — returns list
/store/[storeId]/returns/[returnId]        — return detail
```

## Decisions log

| # | Decision | Why |
| --- | --- | --- |
| 1 | Separate `customers` table, phone-keyed within store | Enables future customer profiles; phone is the natural unique key at the counter |
| 2 | Customer optional on sale | Walk-in sales must still work |
| 3 | Each return is its own `saleReturns` record | Full audit trail; supports multiple partial returns over time |
| 4 | Checkbox + qty input per line on the return page | Handles full-line and partial-line returns in one UI |
| 5 | Combobox search + "+ New customer" dialog on new sale | More discoverable than phone-first; trades a click for clarity |
| 6 | Preset reasons + "Other (note required)" | Forces structured data without locking out legitimate edge cases |
| 7 | Return UI is a page, not a dialog | User explicitly asked to "edit the receipt"; a page maps better to the mental model |
| 8 | No backfill of existing `returnedQuantity` patches | Small dataset; cost > benefit |
| 9 | Returns immutable | Avoids the rabbit hole of "undo a return"; can be revisited later |
