import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { assertPageFunction, assertAnyPageFunction } from "./_helpers/permissions";
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
    await assertAnyPageFunction(ctx.db, args.userId, args.storeId, [
      ["inventory", "view_list"],
      ["sales", "create_sale"],
    ]);

    let products;

    if (args.categoryId) {
      products = await ctx.db
        .query("products")
        .withIndex("by_store_and_category", (q) =>
          q.eq("storeId", args.storeId).eq("categoryId", args.categoryId)
        )
        .collect();
    } else if (!args.includeArchived) {
      products = await ctx.db
        .query("products")
        .withIndex("by_store_and_archived", (q) =>
          q.eq("storeId", args.storeId).eq("isArchived", false)
        )
        .collect();
    } else {
      products = await ctx.db
        .query("products")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
        .collect();
    }

    // Client-side text search filter
    if (args.search) {
      const term = args.search.toLowerCase();
      products = products.filter(
        (p) =>
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
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });

    await assertPageFunction(ctx.db, args.userId, product.storeId, "inventory", "view_list");

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
    costPriceUSD: v.optional(v.number()),
    costPriceLBP: v.optional(v.number()),
    sellingPriceUSD: v.optional(v.number()),
    sellingPriceLBP: v.optional(v.number()),
    lowStockThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "add_product");

    if (
      args.sellingPriceUSD === undefined &&
      args.sellingPriceLBP === undefined
    ) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "At least one selling price (USD or LBP) is required",
      });
    }

    // Check for duplicate barcode within store
    if (args.barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q) =>
          q.eq("storeId", args.storeId).eq("barcode", args.barcode)
        )
        .unique();
      if (existing) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "A product with this barcode already exists",
        });
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
      costPriceUSD: args.costPriceUSD,
      costPriceLBP: args.costPriceLBP,
      sellingPriceUSD: args.sellingPriceUSD,
      sellingPriceLBP: args.sellingPriceLBP,
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
    costPriceUSD: v.optional(v.number()),
    costPriceLBP: v.optional(v.number()),
    sellingPriceUSD: v.optional(v.number()),
    sellingPriceLBP: v.optional(v.number()),
    lowStockThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const product = await ctx.db.get(args.productId);
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });

    await assertPageFunction(ctx.db, args.userId, product.storeId, "inventory", "edit_product");

    // Check barcode uniqueness if changing
    if (args.barcode !== undefined && args.barcode !== product.barcode) {
      const existing = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q) =>
          q.eq("storeId", product.storeId).eq("barcode", args.barcode)
        )
        .unique();
      if (existing) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "A product with this barcode already exists",
        });
      }
    }

    const patch: Partial<Doc<"products">> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.description !== undefined) patch.description = args.description;
    if (args.categoryId !== undefined) patch.categoryId = args.categoryId;
    if (args.barcode !== undefined) patch.barcode = args.barcode;
    if (args.sku !== undefined) patch.sku = args.sku;

    if (args.costPriceUSD !== undefined) patch.costPriceUSD = args.costPriceUSD;
    if (args.costPriceLBP !== undefined) patch.costPriceLBP = args.costPriceLBP;
    if (args.sellingPriceUSD !== undefined)
      patch.sellingPriceUSD = args.sellingPriceUSD;
    if (args.sellingPriceLBP !== undefined)
      patch.sellingPriceLBP = args.sellingPriceLBP;

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
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });

    await assertPageFunction(ctx.db, args.userId, product.storeId, "inventory", "archive_product");

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
    if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });

    await assertPageFunction(ctx.db, args.userId, product.storeId, "inventory", "archive_product");

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
    costPriceUSD: v.optional(v.number()),
    costPriceLBP: v.optional(v.number()),
    sellingPriceUSD: v.optional(v.number()),
    sellingPriceLBP: v.optional(v.number()),
    quantity: v.number(),
    lowStockThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (
      args.sellingPriceUSD === undefined &&
      args.sellingPriceLBP === undefined
    ) {
      throw new ConvexError({
        code: "VALIDATION",
        message: "Each row needs at least one selling price (USD or LBP)",
      });
    }
    await assertPageFunction(ctx.db, args.userId, args.storeId, "inventory", "import_products");

    const sku = args.sku?.trim() || undefined;
    const barcode = args.barcode?.trim() || undefined;
    const name = args.name.trim();
    const description = args.description?.trim() || undefined;

    // Match: SKU first
    let match: Doc<"products"> | null = null;
    if (sku) {
      const all = await ctx.db
        .query("products")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
        .collect();
      match = all.find((p) => p.sku && p.sku.toLowerCase() === sku.toLowerCase()) ?? null;
    }
    // Then barcode
    if (!match && barcode) {
      match = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q) =>
          q.eq("storeId", args.storeId).eq("barcode", barcode)
        )
        .unique();
    }
    // Then name — only when neither side has any identifier
    if (!match && !sku && !barcode) {
      const all = await ctx.db
        .query("products")
        .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
        .collect();
      match = all.find(
        (p) =>
          !p.sku && !p.barcode && p.name.toLowerCase() === name.toLowerCase()
      ) ?? null;
    }

    if (match) {
      // Patch updateable fields. Skip undefined so missing columns preserve
      // existing values; always update sellingPrice (required by client).
      const patch: Partial<Doc<"products">> = { updatedAt: Date.now() };
      if (name) patch.name = name;
      if (description !== undefined) patch.description = description;
      if (args.categoryId !== undefined) patch.categoryId = args.categoryId;
      if (sku !== undefined) patch.sku = sku;
      if (barcode !== undefined && barcode !== match.barcode) {
        const dupe = await ctx.db
          .query("products")
          .withIndex("by_store_and_barcode", (q) =>
            q.eq("storeId", args.storeId).eq("barcode", barcode)
          )
          .unique();
        if (dupe && dupe._id !== match._id) {
          throw new ConvexError({
            code: "CONFLICT",
            message: "A product with this barcode already exists",
          });
        }
        patch.barcode = barcode;
      }
      if (args.costPriceUSD !== undefined)
        patch.costPriceUSD = args.costPriceUSD;
      if (args.costPriceLBP !== undefined)
        patch.costPriceLBP = args.costPriceLBP;
      if (args.sellingPriceUSD !== undefined)
        patch.sellingPriceUSD = args.sellingPriceUSD;
      if (args.sellingPriceLBP !== undefined)
        patch.sellingPriceLBP = args.sellingPriceLBP;
      if (args.lowStockThreshold !== undefined)
        patch.lowStockThreshold = args.lowStockThreshold;

      await ctx.db.patch(match._id, patch);

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
        action: "product_updated_via_import",
        entityType: "product",
        entityId: match._id,
        details: {
          addedQuantity: args.quantity,
          patched: Object.keys(patch).filter((k) => k !== "updatedAt"),
          source: "import",
        },
      });

      return { outcome: "updated" as const, productId: match._id };
    }

    // No match — insert new product (mirrors products.create)
    if (barcode) {
      const dupe = await ctx.db
        .query("products")
        .withIndex("by_store_and_barcode", (q) =>
          q.eq("storeId", args.storeId).eq("barcode", barcode)
        )
        .unique();
      if (dupe) {
        throw new ConvexError({
          code: "CONFLICT",
          message: "A product with this barcode already exists",
        });
      }
    }

    const productId = await ctx.db.insert("products", {
      storeId: args.storeId,
      name,
      description,
      categoryId: args.categoryId,
      barcode,
      sku,
      quantity: 0,
      costPriceUSD: args.costPriceUSD,
      costPriceLBP: args.costPriceLBP,
      sellingPriceUSD: args.sellingPriceUSD,
      sellingPriceLBP: args.sellingPriceLBP,
      lowStockThreshold: args.lowStockThreshold ?? 5,
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
