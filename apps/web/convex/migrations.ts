import { internalMutation, mutation } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { v } from "convex/values";
import { mergeWithDefaults } from "./_helpers/permissions";

// DESTRUCTIVE. Deletes every row in every table.
// Run via: npx convex run migrations:wipeAll '{"confirm":"WIPE"}'
export const wipeAll = internalMutation({
  args: { confirm: v.string() },
  handler: async (ctx, { confirm }) => {
    if (confirm !== "WIPE") throw new Error("Pass confirm: \"WIPE\" to proceed");
    const tables = [
      "saleReturnItems",
      "saleReturns",
      "saleItems",
      "sales",
      "shiftCashEvents",
      "shifts",
      "stockMovements",
      "notifications",
      "auditLogs",
      "products",
      "categories",
      "customers",
      "exchangeRates",
      "storeInvitations",
      "storeRoles",
      "storeMembers",
      "stores",
      "users",
    ] as const;
    const deleted: Record<string, number> = {};
    for (const t of tables) {
      const rows = await ctx.db.query(t).collect();
      for (const r of rows) await ctx.db.delete(r._id);
      deleted[t] = rows.length;
    }
    return deleted;
  },
});

/**
 * One-shot backfill for the dual-currency rollout.
 *
 * Run via: npx convex run migrations:backfillCurrency
 *
 * Idempotent — re-running it on already-migrated rows is a no-op.
 *
 * For each store:
 *   - Seeds an exchangeRates row with rate=1 if none exists.
 * For each product:
 *   - Copies legacy sellingPrice -> sellingPriceUSD (if USD/LBP not set).
 *   - Copies legacy costPrice    -> costPriceUSD.
 * For each sale:
 *   - Sets exchangeRate=1, totalUSD/totalLBP=totalAmount, paidUSD=totalAmount, paidLBP=0.
 * For each saleItem:
 *   - Sets currency="USD", unitPriceUSD=unitPrice.
 * For each saleReturn:
 *   - Sets exchangeRate=1, refundedUSD=totalRefund, refundedLBP=0.
 * For each saleReturnItem:
 *   - Sets currency="USD", unitPriceUSD=unitPrice.
 */
export const backfillCurrency = internalMutation({
  args: {},
  handler: async (ctx) => {
    const touched = {
      stores: 0,
      products: 0,
      sales: 0,
      saleItems: 0,
      saleReturns: 0,
      saleReturnItems: 0,
    };

    const now = Date.now();

    // Seed default exchange rate per store.
    const stores = await ctx.db.query("stores").collect();
    for (const store of stores) {
      const existing = await ctx.db
        .query("exchangeRates")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .first();
      if (existing) continue;
      await ctx.db.insert("exchangeRates", {
        storeId: store._id,
        rate: 1,
        effectiveFrom: store.createdAt,
        note: "Auto-seeded during dual-currency migration",
        createdBy: store.ownerId,
        createdAt: now,
      });
      touched.stores += 1;
    }

    // Products: copy legacy single price into USD slot.
    const products = await ctx.db.query("products").collect();
    for (const p of products) {
      const patch: Partial<Doc<"products">> = {};
      if (
        p.sellingPriceUSD === undefined &&
        p.sellingPriceLBP === undefined &&
        p.sellingPrice !== undefined
      ) {
        patch.sellingPriceUSD = p.sellingPrice;
      }
      if (
        p.costPriceUSD === undefined &&
        p.costPriceLBP === undefined &&
        p.costPrice !== undefined
      ) {
        patch.costPriceUSD = p.costPrice;
      }
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(p._id, patch);
        touched.products += 1;
      }
    }

    // Sales: snapshot rate=1, mirror totalAmount into USD/LBP, mark fully paid in USD.
    const sales = await ctx.db.query("sales").collect();
    for (const s of sales) {
      if (s.exchangeRate !== undefined) continue;
      await ctx.db.patch(s._id, {
        exchangeRate: 1,
        totalUSD: s.totalAmount,
        totalLBP: s.totalAmount,
        paidUSD: s.totalAmount,
        paidLBP: 0,
      });
      touched.sales += 1;
    }

    // SaleItems
    const saleItems = await ctx.db.query("saleItems").collect();
    for (const it of saleItems) {
      if (it.currency !== undefined && it.unitPriceUSD !== undefined) continue;
      await ctx.db.patch(it._id, {
        currency: "USD" as const,
        unitPriceUSD: it.unitPrice,
      });
      touched.saleItems += 1;
    }

    // Returns
    const returns = await ctx.db.query("saleReturns").collect();
    for (const r of returns) {
      if (r.exchangeRate !== undefined) continue;
      await ctx.db.patch(r._id, {
        exchangeRate: 1,
        refundedUSD: r.totalRefund,
        refundedLBP: 0,
      });
      touched.saleReturns += 1;
    }

    // Return items
    const returnItems = await ctx.db.query("saleReturnItems").collect();
    for (const ri of returnItems) {
      if (ri.currency !== undefined && ri.unitPriceUSD !== undefined) continue;
      await ctx.db.patch(ri._id, {
        currency: "USD" as const,
        unitPriceUSD: ri.unitPrice,
      });
      touched.saleReturnItems += 1;
    }

    return touched;
  },
});

// Run once: split category permissions out of inventory into the new categories page.
// Reads any legacy inventory.functions.{create_category,edit_category,remove_category}
// from each storeRole doc and mirrors them onto the new categories page block.
// Run via: npx convex run migrations:splitCategoryPerms
export const splitCategoryPerms = mutation({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("storeRoles").collect();
    let patched = 0;
    const CAT_FNS = ["create_category", "edit_category", "remove_category"] as const;

    for (const role of roles) {
      const tree = (role.permissions ?? {}) as Record<
        string,
        { enabled?: boolean; functions?: Record<string, boolean> } | undefined
      >;
      const inv = tree.inventory;
      const cat = tree.categories;

      // Build new categories block: existing categories perms OR copied from inventory.
      const fns: Record<string, boolean> = { view_list: true };
      let anyGranted = false;
      for (const fn of CAT_FNS) {
        const fromInv = inv?.functions?.[fn] ?? false;
        const fromCat = cat?.functions?.[fn] ?? false;
        const granted = fromCat || fromInv;
        fns[fn] = granted;
        if (granted) anyGranted = true;
      }

      const next = {
        ...tree,
        categories: {
          enabled: cat?.enabled ?? anyGranted,
          functions: fns,
        },
      };

      await ctx.db.patch(role._id, { permissions: next });
      patched++;
    }
    return { patched };
  },
});

// Run once: hydrate custom role docs with any new page/function keys added since they were created.
// npx convex run migrations:backfillRolesV3
export const backfillRolesV3 = mutation({
  args: {},
  handler: async (ctx) => {
    const roles = await ctx.db.query("storeRoles").collect();
    let patched = 0;
    for (const role of roles) {
      const hydrated = mergeWithDefaults(role.permissions);
      await ctx.db.patch(role._id, { permissions: hydrated });
      patched++;
    }
    return { patched };
  },
});

// Run once: migrate editor→employee, assign owner to store creator
export const migrateRolesV2 = mutation({
  args: {},
  handler: async (ctx) => {
    const stores = await ctx.db.query("stores").collect();
    let migrated = 0;

    for (const store of stores) {
      const members = await ctx.db
        .query("storeMembers")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .collect();

      for (const member of members) {
        const patch: Partial<Doc<"storeMembers">> = {};

        // Migrate editor → employee
        if ((member.role as string) === "editor") {
          patch.role = "employee";
        }

        // Assign owner to the store creator if no owner exists
        const hasOwner = members.some((m) => m.role === "owner");
        if (!hasOwner && member.userId === store.ownerId && member.role === "admin") {
          patch.role = "owner";
        }

        if (Object.keys(patch).length > 0) {
          await ctx.db.patch(member._id, patch);
          migrated++;
        }
      }

      // Migrate invitations: editor → employee
      const invitations = await ctx.db
        .query("storeInvitations")
        .withIndex("by_store", (q) => q.eq("storeId", store._id))
        .collect();

      for (const invite of invitations) {
        if ((invite.role as string) === "editor") {
          await ctx.db.patch(invite._id, { role: "employee" });
          migrated++;
        }
      }
    }

    return { migrated };
  },
});
