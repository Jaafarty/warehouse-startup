# Customer-Linked Sales & Returns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attach customers (name + phone) to sales, make sales searchable by customer, and replace the per-line return dialog with a discrete `saleReturns` record + dedicated return page + store-wide returns list.

**Architecture:** A new `customers` table is keyed by phone-per-store. Sales optionally link to a customer (walk-ins still allowed). Returns become first-class records (`saleReturns` + `saleReturnItems`) created via a new `returns.create` mutation that replaces the old `sales.returnItems`. Stock adjustments use the existing `adjustStock(type: "return", referenceType: "sale_return")` helper, but reference the *return id* instead of the sale id. The UI gains a customer picker (combobox + new-customer dialog), a sales search input, a return form page, and two new return pages (list + detail).

**Tech Stack:** Convex (schema + mutations/queries), Next.js 16 App Router (client components, server actions), shadcn/ui v4 (Dialog, Card, Select, Table, Input). Existing helpers: `assertStorePermission`, `adjustStock`, `createAuditLog`. The project has no automated test harness — verification is `npx next build` plus manual smoke tests defined per task.

**Spec:** `docs/superpowers/specs/2026-04-28-customer-returns-design.md`

---

## File Map

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/web/convex/schema.ts` | Modify | Add `customers`, `saleReturns`, `saleReturnItems` tables; add `customerId` to `sales`. |
| `apps/web/convex/customers.ts` | Create | `list` (with search), `getByPhone`, `create`. |
| `apps/web/convex/sales.ts` | Modify | `create` accepts optional `customerId`; `list` accepts `search` + resolves customer; `get` resolves customer; **delete** `returnItems`. |
| `apps/web/convex/returns.ts` | Create | `listByStore`, `getBySale`, `get`, `create`. |
| `apps/web/app/actions/customers.ts` | Create | `createCustomer` server action. |
| `apps/web/app/actions/sales.ts` | Modify | `createSale` accepts `customerId`; **delete** `returnSaleItems`. |
| `apps/web/app/actions/returns.ts` | Create | `createReturn` server action. |
| `apps/web/components/customer-picker.tsx` | Create | Reusable combobox + "+ New customer" dialog. |
| `apps/web/app/(dashboard)/store/[storeId]/sales/new/page.tsx` | Modify | Integrate `<CustomerPicker>`. |
| `apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx` | Modify | Search input; "Customer" column. |
| `apps/web/app/(dashboard)/store/[storeId]/sales/[saleId]/page.tsx` | Modify | Customer card; "Process Return" link (replaces dialog); "Returns history" section. |
| `apps/web/app/(dashboard)/store/[storeId]/sales/[saleId]/return/page.tsx` | Create | Return form page (checkbox + qty + reason). |
| `apps/web/app/(dashboard)/store/[storeId]/returns/page.tsx` | Create | Store-wide returns list (search, filter, date range). |
| `apps/web/app/(dashboard)/store/[storeId]/returns/[returnId]/page.tsx` | Create | Return detail (read-only). |
| `apps/web/components/layout/sidebar.tsx` | Modify | Add "Returns" link. |

---

## Task 1: Schema — add customers, saleReturns, saleReturnItems; add customerId to sales

**Files:**
- Modify: `apps/web/convex/schema.ts`

- [ ] **Step 1: Add `customerId` to `sales`**

In `defineTable` for `sales`, after the `note: v.optional(v.string()),` line, add:

```ts
    customerId: v.optional(v.id("customers")),
```

And after the existing `.index("by_sale_number", ["storeId", "saleNumber"])`, add:

```ts
    .index("by_store_and_customer", ["storeId", "customerId"])
```

- [ ] **Step 2: Add `customers` table**

Add this table definition after the existing `storeInvitations` table (i.e. just before the `// ============ PRODUCTS & CATEGORIES ============` comment), inside `defineSchema({ ... })`:

```ts
  // ============ CUSTOMERS ============
  customers: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    phone: v.string(),
    createdBy: v.id("users"),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_phone", ["storeId", "phone"])
    .index("by_store_and_name", ["storeId", "name"]),
```

- [ ] **Step 3: Add `saleReturns` and `saleReturnItems` tables**

Append these two tables after `saleItems` (i.e. just before the `// ============ NOTIFICATIONS ============` comment):

```ts
  // ============ SALE RETURNS ============
  saleReturns: defineTable({
    storeId: v.id("stores"),
    saleId: v.id("sales"),
    returnNumber: v.string(),
    reason: v.union(
      v.literal("defective"),
      v.literal("wrong_item"),
      v.literal("damaged_in_transit"),
      v.literal("customer_changed_mind"),
      v.literal("other")
    ),
    note: v.optional(v.string()),
    totalRefund: v.float64(),
    itemCount: v.float64(),
    createdBy: v.id("users"),
    createdAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_date", ["storeId", "createdAt"])
    .index("by_sale", ["saleId"])
    .index("by_return_number", ["storeId", "returnNumber"]),

  saleReturnItems: defineTable({
    returnId: v.id("saleReturns"),
    saleItemId: v.id("saleItems"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.float64(),
    unitPrice: v.float64(),
    totalRefund: v.float64(),
  })
    .index("by_return", ["returnId"])
    .index("by_sale_item", ["saleItemId"]),
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully (Convex types are stubs at this point — schema changes don't break the Next build because `convex/` is excluded from the Next tsconfig).

- [ ] **Step 5: Commit**

```bash
git add apps/web/convex/schema.ts
git commit -m "schema: add customers, saleReturns, saleReturnItems; link customer to sale"
```

---

## Task 2: Convex `customers.ts` — list, getByPhone, create

**Files:**
- Create: `apps/web/convex/customers.ts`

- [ ] **Step 1: Create the file**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

export const list = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "sales",
      "view"
    );

    const all = await ctx.db
      .query("customers")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();

    const term = (args.search ?? "").trim().toLowerCase();
    if (!term) return all;

    return all.filter(
      (c: any) =>
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term)
    );
  },
});

export const getByPhone = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "sales",
      "view"
    );

    return await ctx.db
      .query("customers")
      .withIndex("by_store_and_phone", (q: any) =>
        q.eq("storeId", args.storeId).eq("phone", args.phone)
      )
      .unique();
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "sales",
      "edit"
    );

    const name = args.name.trim();
    const phone = args.phone.trim();

    if (!name) throw new Error("Name is required");
    if (!phone) throw new Error("Phone is required");

    const existing = await ctx.db
      .query("customers")
      .withIndex("by_store_and_phone", (q: any) =>
        q.eq("storeId", args.storeId).eq("phone", phone)
      )
      .unique();

    if (existing) {
      throw new Error("A customer with this phone already exists");
    }

    const now = Date.now();
    const customerId = await ctx.db.insert("customers", {
      storeId: args.storeId,
      name,
      phone,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "customer_created",
      entityType: "customer",
      entityId: customerId,
      details: { name, phone },
    });

    return { customerId };
  },
});
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/customers.ts
git commit -m "convex: add customers list/getByPhone/create"
```

---

## Task 3: Server action `actions/customers.ts`

**Files:**
- Create: `apps/web/app/actions/customers.ts`

- [ ] **Step 1: Create the file**

```ts
"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createCustomer(
  storeId: string,
  name: string,
  phone: string
) {
  const userId = await requireCurrentUserId();

  if (!name.trim()) return { success: false, error: "Name is required" };
  if (!phone.trim()) return { success: false, error: "Phone is required" };

  try {
    const result = await convex.mutation(api.customers.create, {
      storeId: storeId as any,
      userId,
      name: name.trim(),
      phone: phone.trim(),
    });
    return { success: true, customerId: result.customerId };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create customer",
    };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/actions/customers.ts
git commit -m "actions: add createCustomer server action"
```

---

## Task 4: `sales.ts` — accept customerId, search in list, resolve customer in get; remove returnItems

**Files:**
- Modify: `apps/web/convex/sales.ts`

- [ ] **Step 1: Update `list` to accept `search` and resolve customers**

Replace the entire `list` export with:

```ts
export const list = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    status: v.optional(
      v.union(
        v.literal("completed"),
        v.literal("returned"),
        v.literal("partially_returned")
      )
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "sales",
      "view"
    );

    let sales;
    if (args.status) {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_store_and_status", (q: any) =>
          q.eq("storeId", args.storeId).eq("status", args.status)
        )
        .order("desc")
        .take(200);
    } else {
      sales = await ctx.db
        .query("sales")
        .withIndex("by_store_and_date", (q: any) =>
          q.eq("storeId", args.storeId)
        )
        .order("desc")
        .take(200);
    }

    // Resolve creators
    const userCache: Record<string, string> = {};
    for (const sale of sales) {
      if (!userCache[sale.createdBy]) {
        const u = await ctx.db.get(sale.createdBy);
        userCache[sale.createdBy] = u?.name ?? "Unknown";
      }
    }

    // Resolve customers
    const customerCache: Record<string, { name: string; phone: string }> = {};
    for (const sale of sales) {
      if (sale.customerId && !customerCache[sale.customerId]) {
        const c = await ctx.db.get(sale.customerId);
        if (c) {
          customerCache[sale.customerId] = { name: c.name, phone: c.phone };
        }
      }
    }

    const enriched = sales.map((s: any) => ({
      ...s,
      createdByName: userCache[s.createdBy],
      customerName: s.customerId
        ? customerCache[s.customerId]?.name ?? null
        : null,
      customerPhone: s.customerId
        ? customerCache[s.customerId]?.phone ?? null
        : null,
    }));

    const term = (args.search ?? "").trim().toLowerCase();
    if (!term) return enriched;

    return enriched.filter(
      (s: any) =>
        s.saleNumber.toLowerCase().includes(term) ||
        (s.customerName && s.customerName.toLowerCase().includes(term)) ||
        (s.customerPhone && s.customerPhone.toLowerCase().includes(term))
    );
  },
});
```

- [ ] **Step 2: Update `get` to resolve customer**

Replace the entire `get` export with:

```ts
export const get = query({
  args: {
    saleId: v.id("sales"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new Error("Sale not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      sale.storeId,
      "sales",
      "view"
    );

    const items = await ctx.db
      .query("saleItems")
      .withIndex("by_sale", (q: any) => q.eq("saleId", args.saleId))
      .collect();

    const creator = await ctx.db.get(sale.createdBy);
    const customer = sale.customerId ? await ctx.db.get(sale.customerId) : null;

    return {
      ...sale,
      createdByName: creator?.name ?? "Unknown",
      customer: customer
        ? { _id: customer._id, name: customer.name, phone: customer.phone }
        : null,
      items,
    };
  },
});
```

- [ ] **Step 3: Update `create` to accept `customerId`**

In the `create` mutation's `args`, add `customerId` after the existing `note` arg:

```ts
    customerId: v.optional(v.id("customers")),
```

In the handler, add this validation block right after the existing `if (args.items.length === 0)` check:

```ts
    if (args.customerId) {
      const customer = await ctx.db.get(args.customerId);
      if (!customer || customer.storeId !== args.storeId) {
        throw new Error("Customer does not belong to this store");
      }
    }
```

In the `ctx.db.insert("sales", { ... })` call, add `customerId: args.customerId,` to the inserted object (anywhere among the other fields — alongside `note` is natural).

- [ ] **Step 4: Delete the `returnItems` mutation entirely**

Remove the entire `export const returnItems = mutation({ ... });` block (lines that were 211–306 in the original file). This functionality moves to `returns.create` in Task 5.

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully. The Next build does NOT typecheck `convex/`, so it will pass even though `api.sales.returnItems` no longer exists. We'll fix consumers in later tasks before they break at runtime.

- [ ] **Step 6: Commit**

```bash
git add apps/web/convex/sales.ts
git commit -m "convex/sales: link customer + add list search; remove returnItems"
```

---

## Task 5: Convex `returns.ts` — listByStore, getBySale, get, create

**Files:**
- Create: `apps/web/convex/returns.ts`

- [ ] **Step 1: Create the file**

```ts
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";
import { adjustStock } from "./_helpers/stock";
import { createAuditLog } from "./_helpers/audit";

const REASON = v.union(
  v.literal("defective"),
  v.literal("wrong_item"),
  v.literal("damaged_in_transit"),
  v.literal("customer_changed_mind"),
  v.literal("other")
);

export const listByStore = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    search: v.optional(v.string()),
    reason: v.optional(REASON),
    fromDate: v.optional(v.float64()),
    toDate: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "sales",
      "view"
    );

    let returns = await ctx.db
      .query("saleReturns")
      .withIndex("by_store_and_date", (q: any) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(500);

    if (args.reason) {
      returns = returns.filter((r: any) => r.reason === args.reason);
    }
    if (args.fromDate !== undefined) {
      returns = returns.filter((r: any) => r.createdAt >= args.fromDate!);
    }
    if (args.toDate !== undefined) {
      returns = returns.filter((r: any) => r.createdAt <= args.toDate!);
    }

    // Resolve sale numbers
    const saleCache: Record<string, any> = {};
    for (const r of returns) {
      if (!saleCache[r.saleId]) {
        const s = await ctx.db.get(r.saleId);
        saleCache[r.saleId] = s;
      }
    }

    // Resolve customers
    const customerCache: Record<string, { name: string; phone: string }> = {};
    for (const r of returns) {
      const sale = saleCache[r.saleId];
      if (sale?.customerId && !customerCache[sale.customerId]) {
        const c = await ctx.db.get(sale.customerId);
        if (c) customerCache[sale.customerId] = { name: c.name, phone: c.phone };
      }
    }

    // Resolve processors
    const userCache: Record<string, string> = {};
    for (const r of returns) {
      if (!userCache[r.createdBy]) {
        const u = await ctx.db.get(r.createdBy);
        userCache[r.createdBy] = u?.name ?? "Unknown";
      }
    }

    const enriched = returns.map((r: any) => {
      const sale = saleCache[r.saleId];
      const cust =
        sale?.customerId && customerCache[sale.customerId]
          ? customerCache[sale.customerId]
          : null;
      return {
        ...r,
        saleNumber: sale?.saleNumber ?? "—",
        customerName: cust?.name ?? null,
        customerPhone: cust?.phone ?? null,
        processedByName: userCache[r.createdBy],
      };
    });

    const term = (args.search ?? "").trim().toLowerCase();
    if (!term) return enriched;

    return enriched.filter(
      (r: any) =>
        r.returnNumber.toLowerCase().includes(term) ||
        r.saleNumber.toLowerCase().includes(term) ||
        (r.customerName && r.customerName.toLowerCase().includes(term)) ||
        (r.customerPhone && r.customerPhone.toLowerCase().includes(term))
    );
  },
});

export const getBySale = query({
  args: {
    saleId: v.id("sales"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new Error("Sale not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      sale.storeId,
      "sales",
      "view"
    );

    const returns = await ctx.db
      .query("saleReturns")
      .withIndex("by_sale", (q: any) => q.eq("saleId", args.saleId))
      .order("desc")
      .collect();

    const userCache: Record<string, string> = {};
    for (const r of returns) {
      if (!userCache[r.createdBy]) {
        const u = await ctx.db.get(r.createdBy);
        userCache[r.createdBy] = u?.name ?? "Unknown";
      }
    }

    return returns.map((r: any) => ({
      ...r,
      processedByName: userCache[r.createdBy],
    }));
  },
});

export const get = query({
  args: {
    returnId: v.id("saleReturns"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const ret = await ctx.db.get(args.returnId);
    if (!ret) throw new Error("Return not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      ret.storeId,
      "sales",
      "view"
    );

    const items = await ctx.db
      .query("saleReturnItems")
      .withIndex("by_return", (q: any) => q.eq("returnId", args.returnId))
      .collect();

    const sale = await ctx.db.get(ret.saleId);
    const customer =
      sale?.customerId ? await ctx.db.get(sale.customerId) : null;
    const processor = await ctx.db.get(ret.createdBy);

    return {
      ...ret,
      items,
      sale: sale
        ? {
            _id: sale._id,
            saleNumber: sale.saleNumber,
            createdAt: sale.createdAt,
          }
        : null,
      customer: customer
        ? { _id: customer._id, name: customer.name, phone: customer.phone }
        : null,
      processedByName: processor?.name ?? "Unknown",
    };
  },
});

export const create = mutation({
  args: {
    saleId: v.id("sales"),
    userId: v.id("users"),
    items: v.array(
      v.object({
        saleItemId: v.id("saleItems"),
        quantity: v.number(),
      })
    ),
    reason: REASON,
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new Error("Sale not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      sale.storeId,
      "sales",
      "edit"
    );

    if (sale.status === "returned") {
      throw new Error("This sale has already been fully returned");
    }

    if (args.items.length === 0) {
      throw new Error("Select at least one item to return");
    }

    const trimmedNote = args.note?.trim() || undefined;
    if (args.reason === "other" && !trimmedNote) {
      throw new Error('Note is required when reason is "Other"');
    }

    // Validate all return quantities & freeze unit prices BEFORE writes
    type Validated = {
      saleItemId: any;
      productId: any;
      productName: string;
      quantity: number;
      unitPrice: number;
    };
    const validated: Validated[] = [];
    let totalRefund = 0;
    let totalCount = 0;

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error("Return quantity must be positive");
      }

      const saleItem = await ctx.db.get(item.saleItemId);
      if (!saleItem) throw new Error("Sale item not found");
      if (saleItem.saleId !== args.saleId) {
        throw new Error("Sale item does not belong to this sale");
      }

      const remaining = saleItem.quantity - saleItem.returnedQuantity;
      if (item.quantity > remaining) {
        throw new Error(
          `Cannot return ${item.quantity} of "${saleItem.productName}". Max returnable: ${remaining}`
        );
      }

      validated.push({
        saleItemId: item.saleItemId,
        productId: saleItem.productId,
        productName: saleItem.productName,
        quantity: item.quantity,
        unitPrice: saleItem.unitPrice,
      });
      totalRefund += saleItem.unitPrice * item.quantity;
      totalCount += item.quantity;
    }

    // Generate return number: R-YYYYMMDD-XXXX
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const returnNumber = `R-${dateStr}-${random}`;

    const returnId = await ctx.db.insert("saleReturns", {
      storeId: sale.storeId,
      saleId: args.saleId,
      returnNumber,
      reason: args.reason,
      note: trimmedNote,
      totalRefund,
      itemCount: totalCount,
      createdBy: args.userId,
      createdAt: now,
    });

    for (const v of validated) {
      await ctx.db.insert("saleReturnItems", {
        returnId,
        saleItemId: v.saleItemId,
        productId: v.productId,
        productName: v.productName,
        quantity: v.quantity,
        unitPrice: v.unitPrice,
        totalRefund: v.unitPrice * v.quantity,
      });

      // Bump running total on the sale item
      const fresh = await ctx.db.get(v.saleItemId);
      if (fresh) {
        await ctx.db.patch(v.saleItemId, {
          returnedQuantity: fresh.returnedQuantity + v.quantity,
        });
      }

      // Restore stock referencing the return id
      await adjustStock(ctx.db, {
        storeId: sale.storeId,
        productId: v.productId,
        type: "return",
        quantityChange: v.quantity,
        performedBy: args.userId,
        referenceId: returnId,
        referenceType: "sale_return",
        note: `Return ${returnNumber}`,
      });
    }

    // Recompute sale status
    const allItems = await ctx.db
      .query("saleItems")
      .withIndex("by_sale", (q: any) => q.eq("saleId", args.saleId))
      .collect();

    const fullyReturned = allItems.every(
      (i: any) => i.returnedQuantity >= i.quantity
    );
    const newStatus = fullyReturned ? "returned" : "partially_returned";

    await ctx.db.patch(args.saleId, {
      status: newStatus as any,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx.db, {
      storeId: sale.storeId,
      userId: args.userId,
      action: "sale_return",
      entityType: "saleReturn",
      entityId: returnId,
      details: {
        returnNumber,
        saleNumber: sale.saleNumber,
        reason: args.reason,
        totalRefund,
        itemCount: totalCount,
        newStatus,
      },
    });

    return { returnId, returnNumber, newStatus };
  },
});
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/web/convex/returns.ts
git commit -m "convex: add returns module (listByStore, getBySale, get, create)"
```

---

## Task 6: Server actions — sales (customerId), returns (createReturn); remove returnSaleItems

**Files:**
- Modify: `apps/web/app/actions/sales.ts`
- Create: `apps/web/app/actions/returns.ts`

- [ ] **Step 1: Update `createSale` to accept `customerId`**

Replace the `createSale` function in `apps/web/app/actions/sales.ts` with:

```ts
export async function createSale(
  storeId: string,
  items: { productId: string; quantity: number }[],
  note?: string,
  customerId?: string
) {
  const userId = await requireCurrentUserId();

  if (items.length === 0) {
    return { success: false, error: "Add at least one item" };
  }

  try {
    const result = await convex.mutation(api.sales.create, {
      storeId: storeId as any,
      userId,
      items: items.map((i) => ({
        productId: i.productId as any,
        quantity: i.quantity,
      })),
      note,
      customerId: customerId ? (customerId as any) : undefined,
    });
    redirect(`/store/${storeId}/sales/${result.saleId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create sale",
    };
  }
}
```

- [ ] **Step 2: Delete `returnSaleItems` from `actions/sales.ts`**

Remove the entire `export async function returnSaleItems(...) { ... }` block. After this step, `actions/sales.ts` should only export `createSale`.

- [ ] **Step 3: Create `actions/returns.ts`**

```ts
"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type Reason =
  | "defective"
  | "wrong_item"
  | "damaged_in_transit"
  | "customer_changed_mind"
  | "other";

export async function createReturn(
  saleId: string,
  items: { saleItemId: string; quantity: number }[],
  reason: Reason,
  note?: string
) {
  const userId = await requireCurrentUserId();

  if (items.length === 0) {
    return { success: false, error: "Select at least one item to return" };
  }

  if (reason === "other" && !note?.trim()) {
    return { success: false, error: "Note is required when reason is Other" };
  }

  try {
    const result = await convex.mutation(api.returns.create, {
      saleId: saleId as any,
      userId,
      items: items.map((i) => ({
        saleItemId: i.saleItemId as any,
        quantity: i.quantity,
      })),
      reason,
      note: note?.trim() || undefined,
    });
    return {
      success: true,
      returnId: result.returnId as string,
      returnNumber: result.returnNumber,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process return",
    };
  }
}
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: **Build will fail** because `apps/web/app/(dashboard)/store/[storeId]/sales/[saleId]/page.tsx` still imports `returnSaleItems`. That's expected — Task 9 fixes it. **For the purposes of this task only**, temporarily verify by running:

`cd apps/web && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -v "sales/\[saleId\]/page.tsx" | head -20`

Expected: No NEW TS errors beyond the pre-existing ones in the sale detail page (which we'll fix in Task 9).

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/actions/sales.ts apps/web/app/actions/returns.ts
git commit -m "actions: createSale accepts customerId; add createReturn; remove returnSaleItems"
```

---

## Task 7: `<CustomerPicker>` reusable component

**Files:**
- Create: `apps/web/components/customer-picker.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCurrentUser } from "@/lib/use-current-user";
import { createCustomer } from "@/app/actions/customers";
import { Plus, X, Search } from "lucide-react";
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

export interface SelectedCustomer {
  _id: string;
  name: string;
  phone: string;
}

interface Props {
  storeId: string;
  value: SelectedCustomer | null;
  onChange: (next: SelectedCustomer | null) => void;
}

export function CustomerPicker({ storeId, value, onChange }: Props) {
  const { userId } = useCurrentUser();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [creating, setCreating] = useState(false);

  const customers = useQuery(
    api.customers.list,
    userId
      ? { storeId: storeId as any, userId: userId as any, search }
      : "skip"
  );

  async function handleCreate() {
    if (!newName.trim() || !newPhone.trim()) {
      toast.error("Name and phone are required");
      return;
    }
    setCreating(true);
    const result = await createCustomer(storeId, newName, newPhone);
    setCreating(false);
    if (!result.success) {
      toast.error(result.error ?? "Failed to create customer");
      return;
    }
    onChange({
      _id: result.customerId as string,
      name: newName.trim(),
      phone: newPhone.trim(),
    });
    setNewName("");
    setNewPhone("");
    setOpen(false);
    toast.success("Customer created");
  }

  if (value) {
    return (
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
        <div className="min-w-0">
          <p className="font-medium truncate">{value.name}</p>
          <p className="text-xs text-muted-foreground truncate">{value.phone}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onChange(null)}
          aria-label="Clear customer"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
            className="pl-8"
          />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md border px-3 h-9 text-sm font-medium hover:bg-muted">
            <Plus className="h-4 w-4 mr-1" />
            New
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>New customer</DialogTitle>
              <DialogDescription>
                Customer is identified by phone number within this store.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Customer name"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone number"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? "Creating..." : "Create customer"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {search && customers && customers.length > 0 && (
        <div className="rounded-md border max-h-56 overflow-y-auto divide-y">
          {customers.map((c: any) => (
            <button
              key={c._id}
              type="button"
              onClick={() =>
                onChange({ _id: c._id, name: c.name, phone: c.phone })
              }
              className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
            >
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">{c.phone}</p>
            </button>
          ))}
        </div>
      )}
      {search && customers && customers.length === 0 && (
        <p className="text-xs text-muted-foreground px-1">
          No matches. Use "+ New" to create a customer.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: **Still fails** at the sale detail page (fixed in Task 9). The new component itself should compile clean — confirm by running:

`cd apps/web && npx tsc --noEmit 2>&1 | grep customer-picker`

Expected: no errors mentioning `customer-picker.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/customer-picker.tsx
git commit -m "components: add CustomerPicker (search combobox + new-customer dialog)"
```

---

## Task 8: New sale page — integrate `<CustomerPicker>`

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/sales/new/page.tsx`

- [ ] **Step 1: Add the import**

Add to the existing import block at the top:

```tsx
import { CustomerPicker, SelectedCustomer } from "@/components/customer-picker";
```

- [ ] **Step 2: Add customer state**

Inside `NewSalePage`, alongside the existing `useState` declarations (after `const [error, setError] = useState<string | null>(null);`):

```tsx
  const [customer, setCustomer] = useState<SelectedCustomer | null>(null);
```

- [ ] **Step 3: Pass customerId to `createSale`**

Replace the `await createSale(...)` call in `handleSubmit` with:

```tsx
    const result = await createSale(
      storeId,
      cart.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      note || undefined,
      customer?._id
    );
```

- [ ] **Step 4: Render the customer card**

Insert this `<Card>` block immediately after the page header `</div>` and before the `error &&` block (i.e. right after the `<div className="flex items-center gap-3">` block that contains the title):

```tsx
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
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx next build`
Expected: Still fails at the sale detail page only (fixed next).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(dashboard\)/store/\[storeId\]/sales/new/page.tsx
git commit -m "sales/new: integrate CustomerPicker"
```

---

## Task 9: Sale detail page — customer card, "Process Return" link, returns history

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/sales/[saleId]/page.tsx`

- [ ] **Step 1: Strip the inline return dialog**

Replace the entire file with the version below. This:
- Removes the inline `Dialog` return UI and the `returnSaleItems` import + state.
- Adds a customer card.
- Replaces "Process Return" Dialog with a `<Link>` to the new return page.
- Adds a "Returns history" section that queries `api.returns.getBySale`.

```tsx
"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowLeft, RotateCcw, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  completed: "default",
  partially_returned: "secondary",
  returned: "outline",
};

const REASON_LABEL: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong item",
  damaged_in_transit: "Damaged in transit",
  customer_changed_mind: "Customer changed mind",
  other: "Other",
};

export default function SaleDetailPage() {
  const { storeId, saleId } = useParams<{
    storeId: string;
    saleId: string;
  }>();
  const { userId } = useCurrentUser();

  const sale = useQuery(
    api.sales.get,
    userId ? { saleId: saleId as any, userId: userId as any } : "skip"
  );

  const returns = useQuery(
    api.returns.getBySale,
    userId ? { saleId: saleId as any, userId: userId as any } : "skip"
  );

  if (sale === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (sale === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Sale not found.</p>
        <Link href={`/store/${storeId}/sales`}>
          <Button variant="link" className="px-0 mt-2">
            Back to sales
          </Button>
        </Link>
      </div>
    );
  }

  const hasReturnableItems = sale.items.some(
    (i: any) => i.returnedQuantity < i.quantity
  );

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/store/${storeId}/sales`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold font-mono">
                {sale.saleNumber}
              </h1>
              <Badge variant={STATUS_VARIANT[sale.status] ?? "outline"}>
                {sale.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {formatDate(sale.createdAt)} by {sale.createdByName}
            </p>
          </div>
        </div>
        {hasReturnableItems && sale.status !== "returned" && (
          <Link
            href={`/store/${storeId}/sales/${saleId}/return`}
            className="inline-flex items-center justify-center rounded-lg border px-2.5 h-8 text-sm font-medium hover:bg-muted"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Process Return
          </Link>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="text-2xl font-bold">
              {formatCurrency(sale.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="text-2xl font-bold">{sale.itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge
              variant={STATUS_VARIANT[sale.status] ?? "outline"}
              className="mt-1"
            >
              {sale.status.replace(/_/g, " ")}
            </Badge>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Customer</p>
            {sale.customer ? (
              <div className="mt-1">
                <p className="font-medium truncate">{sale.customer.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {sale.customer.phone}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground mt-1 flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Walk-in
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {sale.note && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Note</p>
            <p className="mt-1">{sale.note}</p>
          </CardContent>
        </Card>
      )}

      {/* Line Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Returned</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item: any) => (
                <TableRow key={item._id}>
                  <TableCell className="font-medium">
                    {item.productName}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(item.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">{item.quantity}</TableCell>
                  <TableCell className="text-right">
                    {item.returnedQuantity > 0 ? (
                      <span className="text-destructive">
                        {item.returnedQuantity}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.totalPrice)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Returns History */}
      <Card>
        <CardHeader>
          <CardTitle>Returns history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {returns === undefined ? (
            <div className="p-4">
              <Skeleton className="h-12" />
            </div>
          ) : returns.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              No returns processed for this sale yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                  <TableHead>Processed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r: any) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <Link
                        href={`/store/${storeId}/returns/${r._id}`}
                        className="font-mono font-medium hover:underline"
                      >
                        {r.returnNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>{REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                    <TableCell className="text-right">{r.itemCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.totalRefund)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.processedByName}
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
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully. The old `returnSaleItems` import is gone, so the build is now clean.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/store/\[storeId\]/sales/\[saleId\]/page.tsx
git commit -m "sales/[id]: customer card, returns-history, link to return page"
```

---

## Task 10: Return form page

**Files:**
- Create: `apps/web/app/(dashboard)/store/[storeId]/sales/[saleId]/return/page.tsx`

- [ ] **Step 1: Create the directory and file**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { createReturn } from "@/app/actions/returns";
import { formatCurrency } from "@ware-house/shared";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

type Reason =
  | "defective"
  | "wrong_item"
  | "damaged_in_transit"
  | "customer_changed_mind"
  | "other";

const REASONS: { value: Reason; label: string }[] = [
  { value: "defective", label: "Defective" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "damaged_in_transit", label: "Damaged in transit" },
  { value: "customer_changed_mind", label: "Customer changed mind" },
  { value: "other", label: "Other" },
];

export default function ProcessReturnPage() {
  const { storeId, saleId } = useParams<{
    storeId: string;
    saleId: string;
  }>();
  const router = useRouter();
  const { userId } = useCurrentUser();

  const sale = useQuery(
    api.sales.get,
    userId ? { saleId: saleId as any, userId: userId as any } : "skip"
  );

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<Reason>("defective");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const refundTotal = useMemo(() => {
    if (!sale) return 0;
    return sale.items.reduce((sum: number, item: any) => {
      if (!selected[item._id]) return sum;
      const remaining = item.quantity - item.returnedQuantity;
      const qty = Math.min(qtys[item._id] ?? remaining, remaining);
      return sum + qty * item.unitPrice;
    }, 0);
  }, [sale, selected, qtys]);

  if (sale === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (sale === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Sale not found.</p>
      </div>
    );
  }

  function toggleLine(itemId: string, item: any) {
    setSelected((prev) => {
      const next = { ...prev, [itemId]: !prev[itemId] };
      return next;
    });
    setQtys((prev) => {
      if (prev[itemId] !== undefined) return prev;
      return { ...prev, [itemId]: item.quantity - item.returnedQuantity };
    });
  }

  function setQty(itemId: string, raw: number, max: number) {
    const clamped = Math.max(0, Math.min(Math.floor(raw), max));
    setQtys((prev) => ({ ...prev, [itemId]: clamped }));
  }

  async function handleSubmit() {
    const items = Object.entries(selected)
      .filter(([, on]) => on)
      .map(([saleItemId]) => {
        const it = sale!.items.find((i: any) => i._id === saleItemId);
        const remaining = it ? it.quantity - it.returnedQuantity : 0;
        const qty = qtys[saleItemId] ?? remaining;
        return { saleItemId, quantity: Math.min(qty, remaining) };
      })
      .filter((i) => i.quantity > 0);

    if (items.length === 0) {
      toast.error("Select at least one item to return");
      return;
    }

    if (reason === "other" && !note.trim()) {
      toast.error("Note is required when reason is Other");
      return;
    }

    setPending(true);
    const result = await createReturn(
      saleId,
      items,
      reason,
      note.trim() || undefined
    );
    setPending(false);

    if (!result.success) {
      toast.error(result.error ?? "Failed to process return");
      return;
    }

    toast.success(`Return ${result.returnNumber} processed`);
    router.push(`/store/${storeId}/returns/${result.returnId}`);
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/sales/${saleId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            Process return —{" "}
            <span className="font-mono">{sale.saleNumber}</span>
          </h1>
          <p className="text-muted-foreground text-sm">
            Tick items to return. Adjust quantities for partial returns.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items to return</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12" />
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Sold</TableHead>
                <TableHead className="text-right">Already returned</TableHead>
                <TableHead className="text-right">Return qty</TableHead>
                <TableHead className="text-right">Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item: any) => {
                const remaining = item.quantity - item.returnedQuantity;
                const fullyReturned = remaining <= 0;
                const isSelected = !!selected[item._id];
                const qty = qtys[item._id] ?? remaining;
                const refund = isSelected ? qty * item.unitPrice : 0;

                return (
                  <TableRow
                    key={item._id}
                    className={fullyReturned ? "opacity-50" : ""}
                  >
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        disabled={fullyReturned}
                        onCheckedChange={() => toggleLine(item._id, item)}
                        aria-label={`Return ${item.productName}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {item.productName}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.returnedQuantity}
                    </TableCell>
                    <TableCell className="text-right">
                      {isSelected ? (
                        <Input
                          type="number"
                          min={1}
                          max={remaining}
                          value={qty}
                          onChange={(e) =>
                            setQty(item._id, Number(e.target.value), remaining)
                          }
                          className="w-20 ml-auto"
                        />
                      ) : (
                        <span className="text-muted-foreground">
                          {fullyReturned ? "—" : remaining}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {refund > 0 ? formatCurrency(refund) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reason</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select
            value={reason}
            onValueChange={(v) => setReason((v ?? "defective") as Reason)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value} label={r.label}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="space-y-2">
            <Label>
              Note{reason === "other" ? " (required)" : " (optional)"}
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                reason === "other"
                  ? "Describe the reason for the return"
                  : "Optional details"
              }
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between border-t pt-4">
        <div>
          <p className="text-sm text-muted-foreground">Refund total</p>
          <p className="text-2xl font-bold">{formatCurrency(refundTotal)}</p>
        </div>
        <div className="flex gap-3">
          <Link href={`/store/${storeId}/sales/${saleId}`}>
            <Button variant="outline">Cancel</Button>
          </Link>
          <Button onClick={handleSubmit} disabled={pending || refundTotal <= 0}>
            {pending ? "Processing..." : "Save return"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the `Checkbox` component exists**

Run: `ls apps/web/components/ui/checkbox.tsx`
Expected: file exists. If it does NOT exist, add it before continuing:

```bash
cd apps/web && npx shadcn@latest add checkbox
```

- [ ] **Step 3: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully. New route `/store/[storeId]/sales/[saleId]/return` appears in the route list.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(dashboard\)/store/\[storeId\]/sales/\[saleId\]/return/page.tsx
# Also add the checkbox component if shadcn added it:
git add apps/web/components/ui/checkbox.tsx 2>/dev/null || true
git commit -m "sales: add Process Return form page"
```

---

## Task 11: Returns list page (`/store/[storeId]/returns`)

**Files:**
- Create: `apps/web/app/(dashboard)/store/[storeId]/returns/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useState } from "react";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
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
import { Skeleton } from "@/components/ui/skeleton";

const REASON_LABEL: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong item",
  damaged_in_transit: "Damaged in transit",
  customer_changed_mind: "Customer changed mind",
  other: "Other",
};

export default function ReturnsListPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const fromMs = fromDate ? new Date(fromDate).getTime() : undefined;
  // include the end-of-day for `toDate`
  const toMs = toDate
    ? new Date(toDate).getTime() + 24 * 60 * 60 * 1000 - 1
    : undefined;

  const returns = useQuery(
    api.returns.listByStore,
    userId
      ? {
          storeId: storeId as any,
          userId: userId as any,
          search: search || undefined,
          reason: reasonFilter !== "all" ? (reasonFilter as any) : undefined,
          fromDate: fromMs,
          toDate: toMs,
        }
      : "skip"
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returns</h1>
        <p className="text-muted-foreground">
          {returns
            ? `${returns.length} return${returns.length !== 1 ? "s" : ""}`
            : "Loading..."}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search return #, sale #, customer name or phone"
            className="pl-8"
          />
        </div>
        <Select
          value={reasonFilter}
          onValueChange={(v) => setReasonFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All reasons" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All reasons</SelectItem>
            {Object.entries(REASON_LABEL).map(([v, label]) => (
              <SelectItem key={v} value={v} label={label}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {returns === undefined ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : returns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RotateCcw className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No returns</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Returns will appear here once they're processed.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Return #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Sale #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead className="text-right">Refund</TableHead>
                  <TableHead>Processed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((r: any) => (
                  <TableRow key={r._id}>
                    <TableCell>
                      <Link
                        href={`/store/${storeId}/returns/${r._id}`}
                        className="font-mono font-medium hover:underline"
                      >
                        {r.returnNumber}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/store/${storeId}/sales/${r.saleId}`}
                        className="font-mono hover:underline"
                      >
                        {r.saleNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {r.customerName ? (
                        <div>
                          <p className="font-medium">{r.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.customerPhone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Walk-in</span>
                      )}
                    </TableCell>
                    <TableCell>{REASON_LABEL[r.reason] ?? r.reason}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(r.totalRefund)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.processedByName}
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
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully. New route `/store/[storeId]/returns` appears.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/store/\[storeId\]/returns/page.tsx
git commit -m "returns: add store-wide returns list page"
```

---

## Task 12: Return detail page

**Files:**
- Create: `apps/web/app/(dashboard)/store/[storeId]/returns/[returnId]/page.tsx`

- [ ] **Step 1: Create the file**

```tsx
"use client";

import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { formatCurrency, formatDate } from "@ware-house/shared";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

const REASON_LABEL: Record<string, string> = {
  defective: "Defective",
  wrong_item: "Wrong item",
  damaged_in_transit: "Damaged in transit",
  customer_changed_mind: "Customer changed mind",
  other: "Other",
};

export default function ReturnDetailPage() {
  const { storeId, returnId } = useParams<{
    storeId: string;
    returnId: string;
  }>();
  const { userId } = useCurrentUser();

  const ret = useQuery(
    api.returns.get,
    userId
      ? { returnId: returnId as any, userId: userId as any }
      : "skip"
  );

  if (ret === undefined) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (ret === null) {
    return (
      <div className="p-6">
        <p className="text-destructive">Return not found.</p>
        <Link href={`/store/${storeId}/returns`}>
          <Button variant="link" className="px-0 mt-2">
            Back to returns
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/store/${storeId}/returns`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-mono">{ret.returnNumber}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(ret.createdAt)} by {ret.processedByName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total refund</p>
            <p className="text-2xl font-bold">
              {formatCurrency(ret.totalRefund)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Items</p>
            <p className="text-2xl font-bold">{ret.itemCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Reason</p>
            <p className="font-medium mt-1">
              {REASON_LABEL[ret.reason] ?? ret.reason}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Original sale</p>
            {ret.sale ? (
              <Link
                href={`/store/${storeId}/sales/${ret.sale._id}`}
                className="font-mono font-medium mt-1 inline-block hover:underline"
              >
                {ret.sale.saleNumber}
              </Link>
            ) : (
              <p className="text-muted-foreground mt-1">—</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Customer</p>
          {ret.customer ? (
            <div className="mt-1">
              <p className="font-medium">{ret.customer.name}</p>
              <p className="text-sm text-muted-foreground">
                {ret.customer.phone}
              </p>
            </div>
          ) : (
            <p className="mt-1">Walk-in</p>
          )}
        </CardContent>
      </Card>

      {ret.note && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Note</p>
            <p className="mt-1 whitespace-pre-wrap">{ret.note}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Returned items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Refund</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ret.items.map((it: any) => (
                <TableRow key={it._id}>
                  <TableCell className="font-medium">
                    {it.productName}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(it.unitPrice)}
                  </TableCell>
                  <TableCell className="text-right">{it.quantity}</TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(it.totalRefund)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully. New route `/store/[storeId]/returns/[returnId]` appears.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(dashboard\)/store/\[storeId\]/returns/\[returnId\]/page.tsx
git commit -m "returns: add return detail page"
```

---

## Task 13: Sales list page — search input + Customer column

**Files:**
- Modify: `apps/web/app/(dashboard)/store/[storeId]/sales/page.tsx`

- [ ] **Step 1: Add state and search arg**

Replace the `useState` and `useQuery` lines at the top of `SalesPage` with:

```tsx
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const sales = useQuery(
    api.sales.list,
    userId
      ? {
          storeId: storeId as any,
          userId: userId as any,
          status: statusFilter !== "all" ? (statusFilter as any) : undefined,
          search: search || undefined,
        }
      : "skip"
  );
```

- [ ] **Step 2: Add the search input next to the status filter**

Add `Search` to the lucide imports at the top:

```tsx
import { Plus, ShoppingCart, Search } from "lucide-react";
```

And add `Input` to the shadcn imports:

```tsx
import { Input } from "@/components/ui/input";
```

Replace the `<div className="flex items-center gap-3">` block (the one wrapping the status `<Select>`) with:

```tsx
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search sale #, customer name or phone"
            className="pl-8"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? "all")}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="partially_returned">Partially Returned</SelectItem>
            <SelectItem value="returned">Returned</SelectItem>
          </SelectContent>
        </Select>
      </div>
```

- [ ] **Step 3: Add the Customer column**

In the `<TableHeader>` row, insert a new `<TableHead>Customer</TableHead>` between the existing `Status` and `Created By` headers:

```tsx
              <TableRow>
                <TableHead>Sale #</TableHead>
                <TableHead className="text-right">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
```

In the row map, insert the matching `<TableCell>` between Status and Created By:

```tsx
                    <TableCell>
                      {sale.customerName ? (
                        <div>
                          <p className="font-medium">{sale.customerName}</p>
                          <p className="text-xs text-muted-foreground">
                            {sale.customerPhone}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Walk-in</span>
                      )}
                    </TableCell>
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(dashboard\)/store/\[storeId\]/sales/page.tsx
git commit -m "sales: add search input and Customer column"
```

---

## Task 14: Sidebar — add Returns link

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Import the icon and add the link**

Add `RotateCcw` to the lucide imports:

```tsx
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Settings,
  Bell,
  BarChart3,
  RotateCcw,
} from "lucide-react";
```

In the `links` array, insert a new entry after the `Sales` link and before `Analytics`:

```tsx
    {
      href: `${base}/returns`,
      label: "Returns",
      icon: RotateCcw,
      show: permissions.sales !== "none",
    },
```

- [ ] **Step 2: Verify build**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "sidebar: add Returns link"
```

---

## Task 15: Final verification & smoke tests

**Files:** none (manual verification)

- [ ] **Step 1: Final build check**

Run: `cd apps/web && npx next build`
Expected: Compiles successfully. Route list now includes:

```
/store/[storeId]/sales/[saleId]/return
/store/[storeId]/returns
/store/[storeId]/returns/[returnId]
```

(Total ~22 routes.)

- [ ] **Step 2: Push schema to Convex (the user runs this)**

> **Tell the user:** before manual smoke testing, they must run `cd apps/web && npx convex dev` once so the new schema (`customers`, `saleReturns`, `saleReturnItems`, `sales.customerId`) is pushed and `_generated/` types are regenerated. Without this, runtime calls to `api.customers.*` and `api.returns.*` will fail.

- [ ] **Step 3: Manual smoke test — happy path**

In `cd apps/web && npx next dev`, walk through:

1. Open a store → sidebar shows "Returns" link.
2. Sales list → search input is present; existing sales appear with "Walk-in" in the Customer column.
3. New Sale → Customer card appears at top. Search "asdf" → shows "No matches" + "+ New" button. Click "+ New" → dialog → enter name + phone → "Create customer" → chip shows the new customer name + phone with × button.
4. Add products → cart total renders → submit. Sale detail page loads.
5. Sale detail shows the customer in the new card.
6. Click "Process Return" → return form page loads. Tick one line → qty input appears defaulted to remaining. Pick reason "Defective". Click "Save return" → toast → redirects to return detail page.
7. Return detail shows the return number, refund total, items, link back to original sale.
8. Sidebar → Returns → returns list shows the new return. Search by sale number → filters. Filter by reason → filters. Set date range → filters.
9. Sale detail page now shows the return under "Returns history".
10. Stock history for the returned product (`/store/[storeId]/inventory/[productId]/history`) shows a `return` movement with the return note.

- [ ] **Step 4: Manual smoke test — edge cases**

1. **"Other" reason without note**: on the return form, pick reason "Other", leave note blank, click "Save return" → toast says "Note is required when reason is Other"; no return created.
2. **Walk-in sale**: create a sale without picking a customer → sale detail shows "Walk-in" in the Customer card; sales list shows "Walk-in".
3. **Duplicate phone**: in the New Customer dialog, try to create a customer with a phone that already exists → toast surfaces "A customer with this phone already exists".
4. **Search by phone**: in the sales list, type a customer's phone → only their sales appear.
5. **Multiple partial returns**: process a partial return on a 5-unit line (return 2). Then return the same line again (return 1). Sale detail's "Returns history" shows two separate return rows. The line's "Returned" cell on the sale detail shows 3.
6. **Already-fully-returned line**: in the return form, fully-returned lines render with disabled checkbox and dimmed styling.

- [ ] **Step 5: Commit (only if any small fixups were needed)**

If any tweaks were needed during smoke testing:

```bash
git add -A
git commit -m "fixups from manual smoke testing"
```

If nothing needed changing, skip this step.

- [ ] **Step 6: Update CLAUDE.md**

Add a new "Phase 10: Customer-Linked Sales & Returns" section to `CLAUDE.md` summarizing what was built (parallel to the existing Phase 3, 4, 9 entries). Include:
- New tables (`customers`, `saleReturns`, `saleReturnItems`)
- New routes (`/store/[storeId]/sales/[saleId]/return`, `/store/[storeId]/returns`, `/store/[storeId]/returns/[returnId]`)
- That `sales.returnItems` was replaced by `returns.create`
- Build-verified route count update

```bash
git add CLAUDE.md
git commit -m "docs: document customer-linked sales & returns in CLAUDE.md"
```

---

## Self-review

**Spec coverage check:**

| Spec section | Implemented in |
| --- | --- |
| `customers` table | Task 1 |
| `sales.customerId` + index | Task 1 |
| `saleReturns` + `saleReturnItems` tables | Task 1 |
| `customers.list/getByPhone/create` | Task 2 |
| `sales.create` accepts `customerId`, validates store | Task 4 |
| `sales.list` accepts `search`, resolves customer | Task 4 |
| `sales.get` resolves customer | Task 4 |
| `sales.returnItems` removed | Task 4 |
| `returns.listByStore` (+ search/reason/date filters) | Task 5 |
| `returns.getBySale` | Task 5 |
| `returns.get` | Task 5 |
| `returns.create` (validation, freezing prices, `referenceId: returnId`, status recompute, audit) | Task 5 |
| `actions/customers.createCustomer` | Task 3 |
| `actions/sales.createSale` accepts customerId; returnSaleItems removed | Task 6 |
| `actions/returns.createReturn` | Task 6 |
| New sale page customer picker (combobox + dialog, walk-in default) | Tasks 7, 8 |
| Sales list search + Customer column | Task 13 |
| Sale detail customer card | Task 9 |
| Sale detail returns history | Task 9 |
| Sale detail "Process Return" link (replaces dialog) | Task 9 |
| Return form page (checkbox + qty + reason + note) | Task 10 |
| Returns list page (search, reason, date range) | Task 11 |
| Return detail page (read-only) | Task 12 |
| Sidebar Returns link | Task 14 |
| Build verification + smoke tests | Task 15 |

All spec requirements have a task. No backfill of historical `returnedQuantity` (per spec non-goal).

**Type consistency:** `returnId`, `saleId`, `customerId`, `saleItemId` IDs are spelled consistently. The reason union literal values (`defective`, `wrong_item`, `damaged_in_transit`, `customer_changed_mind`, `other`) match across `schema.ts`, `convex/returns.ts`, `actions/returns.ts`, the return form page, and the returns list page.

**Placeholders:** none — every step has the actual code or command to run.
