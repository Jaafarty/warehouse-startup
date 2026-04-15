import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";
import { adjustStock } from "./_helpers/stock";
import { createAuditLog } from "./_helpers/audit";

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

    // Attach creator names
    const userCache: Record<string, string> = {};
    for (const sale of sales) {
      if (!userCache[sale.createdBy]) {
        const u = await ctx.db.get(sale.createdBy);
        userCache[sale.createdBy] = u?.name ?? "Unknown";
      }
    }

    return sales.map((s: any) => ({
      ...s,
      createdByName: userCache[s.createdBy],
    }));
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

    return {
      ...sale,
      createdByName: creator?.name ?? "Unknown",
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
      })
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "sales",
      "edit"
    );

    if (args.items.length === 0) {
      throw new Error("Sale must have at least one item");
    }

    // Generate sale number: S-YYYYMMDD-XXXX
    const now = Date.now();
    const dateStr = new Date(now).toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const saleNumber = `S-${dateStr}-${random}`;

    let totalAmount = 0;
    let totalItems = 0;

    // Validate all products and calculate totals before making changes
    const itemDetails: {
      productId: any;
      product: any;
      quantity: number;
    }[] = [];

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

      totalAmount += product.sellingPrice * item.quantity;
      totalItems += item.quantity;
      itemDetails.push({ productId: item.productId, product, quantity: item.quantity });
    }

    // Create sale record
    const saleId = await ctx.db.insert("sales", {
      storeId: args.storeId,
      saleNumber,
      status: "completed",
      totalAmount,
      itemCount: totalItems,
      note: args.note,
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
        unitPrice: detail.product.sellingPrice,
        totalPrice: detail.product.sellingPrice * detail.quantity,
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
      details: { saleNumber, totalAmount, itemCount: totalItems },
    });

    return { saleId, saleNumber };
  },
});

export const returnItems = mutation({
  args: {
    saleId: v.id("sales"),
    userId: v.id("users"),
    items: v.array(
      v.object({
        saleItemId: v.id("saleItems"),
        quantity: v.number(),
      })
    ),
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

    for (const item of args.items) {
      if (item.quantity <= 0) {
        throw new Error("Return quantity must be positive");
      }

      const saleItem = await ctx.db.get(item.saleItemId);
      if (!saleItem) throw new Error("Sale item not found");
      if (saleItem.saleId !== args.saleId) {
        throw new Error("Sale item does not belong to this sale");
      }

      const maxReturnable = saleItem.quantity - saleItem.returnedQuantity;
      if (item.quantity > maxReturnable) {
        throw new Error(
          `Cannot return ${item.quantity} of "${saleItem.productName}". Max returnable: ${maxReturnable}`
        );
      }

      // Update returned quantity on sale item
      await ctx.db.patch(item.saleItemId, {
        returnedQuantity: saleItem.returnedQuantity + item.quantity,
      });

      // Restore stock
      await adjustStock(ctx.db, {
        storeId: sale.storeId,
        productId: saleItem.productId,
        type: "return",
        quantityChange: item.quantity,
        performedBy: args.userId,
        referenceId: args.saleId,
        referenceType: "sale_return",
        note: args.note || `Return for sale ${sale.saleNumber}`,
      });
    }

    // Determine new sale status
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
      entityType: "sale",
      entityId: args.saleId,
      details: {
        saleNumber: sale.saleNumber,
        returnedItems: args.items.length,
        newStatus,
      },
    });

    return { success: true, newStatus };
  },
});
