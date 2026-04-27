import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";
import { adjustStock } from "./_helpers/stock";
import { createAuditLog } from "./_helpers/audit";

export const list = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    categoryId: v.optional(v.id("categories")),
    includeArchived: v.optional(v.boolean()),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "inventory",
      "view"
    );

    let products;

    if (args.categoryId) {
      products = await ctx.db
        .query("products")
        .withIndex("by_store_and_category", (q: any) =>
          q.eq("storeId", args.storeId).eq("categoryId", args.categoryId)
        )
        .collect();
    } else if (!args.includeArchived) {
      products = await ctx.db
        .query("products")
        .withIndex("by_store_and_archived", (q: any) =>
          q.eq("storeId", args.storeId).eq("isArchived", false)
        )
        .collect();
    } else {
      products = await ctx.db
        .query("products")
        .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
        .collect();
    }

    // Client-side text search filter
    if (args.search) {
      const term = args.search.toLowerCase();
      products = products.filter(
        (p: any) =>
          p.name.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term)
      );
    }

    return products;
  },
});

export const get = query({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      product.storeId,
      "inventory",
      "view"
    );

    // Attach category name if set
    let categoryName: string | undefined;
    if (product.categoryId) {
      const cat = await ctx.db.get(product.categoryId);
      categoryName = cat?.name;
    }

    return { ...product, categoryName };
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    barcode: v.optional(v.string()),
    sku: v.optional(v.string()),
    quantity: v.number(),
    costPrice: v.number(),
    sellingPrice: v.number(),
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

    // Check for duplicate barcode within store
    if (args.barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q: any) =>
          q.eq("storeId", args.storeId).eq("barcode", args.barcode)
        )
        .unique();
      if (existing) {
        throw new Error("A product with this barcode already exists");
      }
    }

    const productId = await ctx.db.insert("products", {
      storeId: args.storeId,
      name: args.name,
      description: args.description,
      categoryId: args.categoryId,
      barcode: args.barcode,
      sku: args.sku,
      quantity: 0, // Start at 0, adjustStock will set the initial quantity
      costPrice: args.costPrice,
      sellingPrice: args.sellingPrice,
      lowStockThreshold: args.lowStockThreshold,
      isArchived: false,
      createdBy: args.userId,
      updatedAt: Date.now(),
    });

    // Record initial stock via adjustStock helper
    if (args.quantity > 0) {
      await adjustStock(ctx.db, {
        storeId: args.storeId,
        productId,
        type: "initial",
        quantityChange: args.quantity,
        performedBy: args.userId,
        note: "Initial stock on product creation",
      });
    }

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "product_created",
      entityType: "product",
      entityId: productId,
      details: { name: args.name, initialQuantity: args.quantity },
    });

    return productId;
  },
});

export const update = mutation({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    barcode: v.optional(v.string()),
    sku: v.optional(v.string()),
    costPrice: v.optional(v.number()),
    sellingPrice: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      product.storeId,
      "inventory",
      "edit"
    );

    // Check barcode uniqueness if changing
    if (args.barcode !== undefined && args.barcode !== product.barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q: any) =>
          q.eq("storeId", product.storeId).eq("barcode", args.barcode)
        )
        .unique();
      if (existing) {
        throw new Error("A product with this barcode already exists");
      }
    }

    const patch: Record<string, any> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.categoryId !== undefined) patch.categoryId = args.categoryId;
    if (args.barcode !== undefined) patch.barcode = args.barcode;
    if (args.sku !== undefined) patch.sku = args.sku;
    if (args.costPrice !== undefined) patch.costPrice = args.costPrice;
    if (args.sellingPrice !== undefined) patch.sellingPrice = args.sellingPrice;
    if (args.lowStockThreshold !== undefined)
      patch.lowStockThreshold = args.lowStockThreshold;

    await ctx.db.patch(args.productId, patch);

    await createAuditLog(ctx.db, {
      storeId: product.storeId,
      userId: args.userId,
      action: "product_updated",
      entityType: "product",
      entityId: args.productId,
      details: patch,
    });

    return { success: true };
  },
});

export const archive = mutation({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      product.storeId,
      "inventory",
      "full"
    );

    await ctx.db.patch(args.productId, {
      isArchived: true,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx.db, {
      storeId: product.storeId,
      userId: args.userId,
      action: "product_archived",
      entityType: "product",
      entityId: args.productId,
      details: { name: product.name },
    });

    return { success: true };
  },
});

export const restore = mutation({
  args: {
    productId: v.id("products"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new Error("Product not found");

    await assertStorePermission(
      ctx.db,
      args.userId,
      product.storeId,
      "inventory",
      "full"
    );

    await ctx.db.patch(args.productId, {
      isArchived: false,
      updatedAt: Date.now(),
    });

    await createAuditLog(ctx.db, {
      storeId: product.storeId,
      userId: args.userId,
      action: "product_restored",
      entityType: "product",
      entityId: args.productId,
      details: { name: product.name },
    });

    return { success: true };
  },
});

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
