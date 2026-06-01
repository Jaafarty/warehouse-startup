import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { assertPageFunction } from "./_helpers/permissions";
import { adjustStock } from "./_helpers/stock";
import { createAuditLog } from "./_helpers/audit";
import {
  recordCashEvent,
  requireActiveShift,
} from "./_helpers/shifts";

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
    await assertPageFunction(ctx.db, args.userId, args.storeId, "returns", "view_list");

    let returns = await ctx.db
      .query("saleReturns")
      .withIndex("by_store_and_date", (q) => q.eq("storeId", args.storeId))
      .order("desc")
      .take(500);

    if (args.reason) {
      returns = returns.filter((r) => r.reason === args.reason);
    }
    if (args.fromDate !== undefined) {
      returns = returns.filter((r) => r.createdAt >= args.fromDate!);
    }
    if (args.toDate !== undefined) {
      returns = returns.filter((r) => r.createdAt <= args.toDate!);
    }

    // Resolve sale numbers
    const saleCache: Record<string, Doc<"sales"> | null> = {};
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

    const enriched = returns.map((r) => {
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
      (r) =>
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
    if (!sale) throw new ConvexError({ code: "NOT_FOUND", message: "Sale not found" });

    await assertPageFunction(ctx.db, args.userId, sale.storeId, "returns", "view_list");

    const returns = await ctx.db
      .query("saleReturns")
      .withIndex("by_sale", (q) => q.eq("saleId", args.saleId))
      .order("desc")
      .collect();

    const userCache: Record<string, string> = {};
    for (const r of returns) {
      if (!userCache[r.createdBy]) {
        const u = await ctx.db.get(r.createdBy);
        userCache[r.createdBy] = u?.name ?? "Unknown";
      }
    }

    return returns.map((r) => ({
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
    if (!ret) throw new ConvexError({ code: "NOT_FOUND", message: "Return not found" });

    await assertPageFunction(ctx.db, args.userId, ret.storeId, "returns", "view_list");

    const items = await ctx.db
      .query("saleReturnItems")
      .withIndex("by_return", (q) => q.eq("returnId", args.returnId))
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
    // Cashier-picked refund split. Both default to 0; sum must equal the
    // refundable amount in USD-equivalent at the SALE's snapshot rate.
    refundedUSD: v.optional(v.number()),
    refundedLBP: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new ConvexError({ code: "NOT_FOUND", message: "Sale not found" });

    await assertPageFunction(ctx.db, args.userId, sale.storeId, "returns", "process_return");

    const activeShift = await requireActiveShift(
      ctx.db,
      args.userId,
      sale.storeId
    );

    if (sale.status === "returned") {
      throw new ConvexError({
        code: "ALREADY_RETURNED",
        message: "This sale has already been fully returned",
      });
    }

    if (args.items.length === 0) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Select at least one item to return",
      });
    }

    const trimmedNote = args.note?.trim() || undefined;
    if (args.reason === "other" && !trimmedNote) {
      throw new ConvexError({
        code: "VALIDATION",
        message: 'Note is required when reason is "Other"',
      });
    }

    // Use the SALE's snapshot rate (NEVER the current rate) so refund math
    // matches what the customer originally paid.
    const saleRate = sale.exchangeRate ?? 1;

    // Validate all return quantities & freeze unit prices BEFORE writes
    type Validated = {
      saleItemId: Id<"saleItems">;
      productId: Id<"products">;
      productName: string;
      quantity: number;
      unitPrice: number;
      currency: "USD" | "LBP";
      unitPriceUSD: number;
    };
    const validated: Validated[] = [];
    let totalRefundUSD = 0;
    let totalCount = 0;

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new ConvexError({
          code: "VALIDATION",
          message: "Return quantity must be positive",
        });
      }

      const saleItem = await ctx.db.get(item.saleItemId);
      if (!saleItem) throw new ConvexError({ code: "NOT_FOUND", message: "Sale item not found" });
      if (saleItem.saleId !== args.saleId) {
        throw new ConvexError({
          code: "VALIDATION",
          message: "Sale item does not belong to this sale",
        });
      }

      const remaining = saleItem.quantity - saleItem.returnedQuantity;
      if (item.quantity > remaining) {
        throw new ConvexError({
          code: "VALIDATION",
          message: `Cannot return ${item.quantity} of "${saleItem.productName}". Max returnable: ${remaining}`,
        });
      }

      const itemCurrency: "USD" | "LBP" = saleItem.currency ?? "USD";
      // Prefer the snapshotted USD figure; fall back for legacy items.
      const itemUnitPriceUSD =
        saleItem.unitPriceUSD ??
        (itemCurrency === "USD"
          ? saleItem.unitPrice
          : saleItem.unitPrice / saleRate);

      validated.push({
        saleItemId: item.saleItemId,
        productId: saleItem.productId,
        productName: saleItem.productName,
        quantity: item.quantity,
        unitPrice: saleItem.unitPrice,
        currency: itemCurrency,
        unitPriceUSD: itemUnitPriceUSD,
      });
      totalRefundUSD += itemUnitPriceUSD * item.quantity;
      totalCount += item.quantity;
    }

    // Refund split — defaults to single-currency refund in USD if cashier
    // doesn't specify (preserves the legacy behavior).
    const refundedUSD = args.refundedUSD ?? 0;
    const refundedLBP = args.refundedLBP ?? 0;
    if (refundedUSD < 0 || refundedLBP < 0) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Refund amounts cannot be negative",
      });
    }
    const cashierTotalUSD = refundedUSD + refundedLBP / saleRate;
    // If both are zero we treat it as "refund the full eligible amount in USD"
    // to keep the existing UI flow working without a refund-split panel.
    const finalRefundedUSD =
      refundedUSD === 0 && refundedLBP === 0 ? totalRefundUSD : refundedUSD;
    const finalRefundedLBP =
      refundedUSD === 0 && refundedLBP === 0 ? 0 : refundedLBP;
    if (refundedUSD !== 0 || refundedLBP !== 0) {
      if (Math.abs(cashierTotalUSD - totalRefundUSD) > 0.01) {
        throw new ConvexError({
          code: "VALIDATION",
          message: `Refund split (USD-eq $${cashierTotalUSD.toFixed(2)}) must equal eligible refund $${totalRefundUSD.toFixed(2)}`,
        });
      }
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
      totalRefund: totalRefundUSD,
      itemCount: totalCount,
      exchangeRate: saleRate,
      refundedUSD: finalRefundedUSD,
      refundedLBP: finalRefundedLBP,
      shiftId: activeShift._id,
      createdBy: args.userId,
      createdAt: now,
    });

    // Refunds reduce drawer cash → negative deltas.
    await recordCashEvent(ctx.db, {
      storeId: sale.storeId,
      shiftId: activeShift._id,
      registerId: activeShift.registerId,
      type: "return",
      amountUSD: -finalRefundedUSD,
      amountLBP: -finalRefundedLBP,
      referenceType: "sale_return",
      referenceId: returnId,
      performedBy: args.userId,
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
        currency: v.currency,
        unitPriceUSD: v.unitPriceUSD,
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
      .withIndex("by_sale", (q) => q.eq("saleId", args.saleId))
      .collect();

    const fullyReturned = allItems.every(
      (i) => i.returnedQuantity >= i.quantity
    );
    const newStatus = fullyReturned ? "returned" : "partially_returned";

    await ctx.db.patch(args.saleId, {
      status: newStatus as Doc<"sales">["status"],
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
        totalRefundUSD,
        refundedUSD: finalRefundedUSD,
        refundedLBP: finalRefundedLBP,
        exchangeRate: saleRate,
        itemCount: totalCount,
        newStatus,
      },
    });

    return { returnId, returnNumber, newStatus };
  },
});
