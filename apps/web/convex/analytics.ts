import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";

export const overview = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    startDate: v.optional(v.float64()),
    endDate: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const now = Date.now();
    const start = args.startDate ?? now - 30 * 24 * 60 * 60 * 1000; // default 30 days
    const end = args.endDate ?? now;

    // Get all sales in date range
    const sales = await ctx.db
      .query("sales")
      .withIndex("by_store_and_date", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect();

    const salesInRange = sales.filter(
      (s: any) => s.createdAt >= start && s.createdAt <= end
    );

    const totalRevenue = salesInRange
      .filter((s: any) => s.status !== "returned")
      .reduce((sum: number, s: any) => sum + s.totalAmount, 0);

    const totalSales = salesInRange.length;
    const completedSales = salesInRange.filter(
      (s: any) => s.status === "completed"
    ).length;

    // Products overview
    const products = await ctx.db
      .query("products")
      .withIndex("by_store_and_archived", (q: any) =>
        q.eq("storeId", args.storeId).eq("isArchived", false)
      )
      .collect();

    const totalProducts = products.length;
    const lowStockProducts = products.filter(
      (p: any) => p.quantity <= p.lowStockThreshold
    ).length;
    const outOfStockProducts = products.filter(
      (p: any) => p.quantity === 0
    ).length;
    const totalInventoryValue = products.reduce(
      (sum: number, p: any) => sum + p.costPrice * p.quantity,
      0
    );

    return {
      totalRevenue,
      totalSales,
      completedSales,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
      totalInventoryValue,
    };
  },
});

export const topProducts = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const limit = args.limit ?? 5;

    // Get all sale items for the store
    const saleItems = await ctx.db
      .query("saleItems")
      .withIndex("by_store_and_product", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect();

    // Aggregate by product
    const productTotals: Record<
      string,
      { productName: string; totalQuantity: number; totalRevenue: number }
    > = {};

    for (const item of saleItems) {
      const key = item.productId;
      if (!productTotals[key]) {
        productTotals[key] = {
          productName: item.productName,
          totalQuantity: 0,
          totalRevenue: 0,
        };
      }
      productTotals[key].totalQuantity += item.quantity - item.returnedQuantity;
      productTotals[key].totalRevenue +=
        item.unitPrice * (item.quantity - item.returnedQuantity);
    }

    return Object.entries(productTotals)
      .map(([productId, data]) => ({ productId, ...data }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit);
  },
});

export const salesTrend = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const days = args.days ?? 14;
    const now = Date.now();
    const start = now - days * 24 * 60 * 60 * 1000;

    const sales = await ctx.db
      .query("sales")
      .withIndex("by_store_and_date", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect();

    const salesInRange = sales.filter((s: any) => s.createdAt >= start);

    // Group by day
    const dailyData: Record<string, { revenue: number; count: number }> = {};

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date(now - (days - 1 - i) * 24 * 60 * 60 * 1000);
      const key = date.toISOString().slice(0, 10);
      dailyData[key] = { revenue: 0, count: 0 };
    }

    for (const sale of salesInRange) {
      if (sale.status === "returned") continue;
      const key = new Date(sale.createdAt).toISOString().slice(0, 10);
      if (dailyData[key]) {
        dailyData[key].revenue += sale.totalAmount;
        dailyData[key].count += 1;
      }
    }

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      label: new Date(date + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      ...data,
    }));
  },
});
