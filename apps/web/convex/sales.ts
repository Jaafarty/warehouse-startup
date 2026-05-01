import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPageFunction } from "./_helpers/permissions";
import { adjustStock } from "./_helpers/stock";
import { createAuditLog } from "./_helpers/audit";
import {
  getCurrentRate,
  convertToUSD,
  type Currency,
} from "./_helpers/exchangeRate";

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
    await assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "view_list");

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

export const get = query({
  args: {
    saleId: v.id("sales"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const sale = await ctx.db.get(args.saleId);
    if (!sale) throw new Error("Sale not found");

    await assertPageFunction(ctx.db, args.userId, sale.storeId, "sales", "view_list");

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

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    items: v.array(
      v.object({
        productId: v.id("products"),
        quantity: v.number(),
        currency: v.union(v.literal("USD"), v.literal("LBP")),
      })
    ),
    payments: v.object({
      paidUSD: v.number(),
      paidLBP: v.number(),
    }),
    note: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "sales", "create_sale");

    if (args.items.length === 0) {
      throw new Error("Sale must have at least one item");
    }

    if (args.customerId) {
      const customer = await ctx.db.get(args.customerId);
      if (!customer || customer.storeId !== args.storeId) {
        throw new Error("Customer does not belong to this store");
      }
    }

    // Snapshot current rate at sale creation. Future rate changes never
    // touch this sale's totals or refunds.
    const exchangeRate = await getCurrentRate(ctx.db, args.storeId);
    if (exchangeRate <= 0) {
      throw new Error("Exchange rate must be set before creating sales");
    }

    // Generate sale number: S-YYYYMMDD-XXXX
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const saleNumber = `S-${dateStr}-${random}`;

    let totalUSD = 0;
    let totalItems = 0;

    type ItemDetail = {
      productId: any;
      product: any;
      quantity: number;
      currency: Currency;
      unitPrice: number; // in `currency`
      unitPriceUSD: number; // canonical
    };
    const itemDetails: ItemDetail[] = [];

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error("Quantity must be positive");
      }

      const product = await ctx.db.get(item.productId);
      if (!product) throw new Error("Product not found");
      if (product.storeId !== args.storeId) {
        throw new Error("Product does not belong to this store");
      }
      if (product.isArchived) {
        throw new Error(`Product "${product.name}" is archived`);
      }
      if (product.quantity < item.quantity) {
        throw new Error(
          `Insufficient stock for "${product.name}". Available: ${product.quantity}, Requested: ${item.quantity}`
        );
      }

      // Resolve unit price in the requested currency. Falls back to the other
      // side via the snapshot rate so a USD-only product can still be sold in
      // LBP, etc.
      const usdPrice =
        product.sellingPriceUSD ?? product.sellingPrice;
      const lbpPrice = product.sellingPriceLBP;
      let unitPrice: number;
      if (item.currency === "USD") {
        if (usdPrice !== undefined) unitPrice = usdPrice;
        else if (lbpPrice !== undefined) unitPrice = lbpPrice / exchangeRate;
        else throw new Error(`Product "${product.name}" has no price set`);
      } else {
        if (lbpPrice !== undefined) unitPrice = lbpPrice;
        else if (usdPrice !== undefined) unitPrice = usdPrice * exchangeRate;
        else throw new Error(`Product "${product.name}" has no price set`);
      }

      const unitPriceUSD = convertToUSD(unitPrice, item.currency, exchangeRate);
      totalUSD += unitPriceUSD * item.quantity;
      totalItems += item.quantity;
      itemDetails.push({
        productId: item.productId,
        product,
        quantity: item.quantity,
        currency: item.currency,
        unitPrice,
        unitPriceUSD,
      });
    }

    // Validate payment covers total. Allow over-pay (change due); reject under-pay.
    const paidUSD = args.payments.paidUSD;
    const paidLBP = args.payments.paidLBP;
    if (paidUSD < 0 || paidLBP < 0) {
      throw new Error("Payment amounts cannot be negative");
    }
    const tenderedUSD = paidUSD + paidLBP / exchangeRate;
    // Allow a small floating-point tolerance.
    if (tenderedUSD + 1e-6 < totalUSD) {
      throw new Error(
        `Insufficient payment. Total $${totalUSD.toFixed(2)} (incl LBP ${(totalUSD * exchangeRate).toFixed(0)}); tendered equivalent $${tenderedUSD.toFixed(2)}`
      );
    }

    const totalLBP = totalUSD * exchangeRate;

    // Create sale record
    const saleId = await ctx.db.insert("sales", {
      storeId: args.storeId,
      saleNumber,
      status: "completed",
      totalAmount: totalUSD, // canonical figure for legacy analytics paths
      totalUSD,
      totalLBP,
      exchangeRate,
      paidUSD,
      paidLBP,
      itemCount: totalItems,
      note: args.note,
      customerId: args.customerId,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    // Create sale items and decrement stock
    for (const detail of itemDetails) {
      await ctx.db.insert("saleItems", {
        saleId,
        storeId: args.storeId,
        productId: detail.productId,
        productName: detail.product.name,
        quantity: detail.quantity,
        unitPrice: detail.unitPrice,
        totalPrice: detail.unitPrice * detail.quantity,
        currency: detail.currency,
        unitPriceUSD: detail.unitPriceUSD,
        returnedQuantity: 0,
      });

      await adjustStock(ctx.db, {
        storeId: args.storeId,
        productId: detail.productId,
        type: "sale",
        quantityChange: -detail.quantity,
        performedBy: args.userId,
        referenceId: saleId,
        referenceType: "sale",
        note: `Sale ${saleNumber}`,
      });
    }

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "sale_created",
      entityType: "sale",
      entityId: saleId,
      details: {
        saleNumber,
        totalUSD,
        totalLBP,
        exchangeRate,
        paidUSD,
        paidLBP,
        itemCount: totalItems,
      },
    });

    return {
      saleId,
      saleNumber,
      totalUSD,
      totalLBP,
      exchangeRate,
      // Change due as a single USD-equivalent figure; UI splits visually.
      changeDueUSD: tenderedUSD - totalUSD,
    };
  },
});
