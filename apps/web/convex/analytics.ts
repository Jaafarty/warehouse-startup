import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertStorePermission } from "./_helpers/permissions";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function monthKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - day);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function addMonths(ts: number, months: number): number {
  const d = new Date(ts);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1);
}

// Effective USD-equivalent revenue per saleItem after partial returns.
// Falls back to `unitPrice` for legacy items where the dual-currency backfill
// has not run yet — those are USD-only.
function itemRevenue(item: any): number {
  const unitUSD = item.unitPriceUSD ?? item.unitPrice;
  return unitUSD * (item.quantity - item.returnedQuantity);
}

function itemUnits(item: any): number {
  return item.quantity - item.returnedQuantity;
}

async function loadStoreSalesData(ctx: any, storeId: any) {
  const sales = await ctx.db
    .query("sales")
    .withIndex("by_store_and_date", (q: any) => q.eq("storeId", storeId))
    .collect();
  const saleItems = await ctx.db
    .query("saleItems")
    .withIndex("by_store_and_product", (q: any) => q.eq("storeId", storeId))
    .collect();

  const itemsBySale: Record<string, any[]> = {};
  for (const item of saleItems) {
    const key = String(item.saleId);
    (itemsBySale[key] ??= []).push(item);
  }

  return { sales, saleItems, itemsBySale };
}

function saleRevenue(sale: any, itemsBySale: Record<string, any[]>): number {
  const items = itemsBySale[String(sale._id)] ?? [];
  return items.reduce((s: number, i: any) => s + itemRevenue(i), 0);
}

// =========================
// EXISTING QUERIES (kept for landing dashboard backward-compat)
// =========================

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
    const start = args.startDate ?? now - 30 * DAY_MS;
    const end = args.endDate ?? now;

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
      (sum: number, p: any) =>
        sum + (p.costPriceUSD ?? p.costPrice ?? 0) * p.quantity,
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

    const saleItems = await ctx.db
      .query("saleItems")
      .withIndex("by_store_and_product", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect();

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
      productTotals[key].totalQuantity += itemUnits(item);
      productTotals[key].totalRevenue += itemRevenue(item);
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
    const start = now - days * DAY_MS;

    const sales = await ctx.db
      .query("sales")
      .withIndex("by_store_and_date", (q: any) =>
        q.eq("storeId", args.storeId)
      )
      .collect();

    const salesInRange = sales.filter((s: any) => s.createdAt >= start);

    const dailyData: Record<string, { revenue: number; count: number }> = {};

    for (let i = 0; i < days; i++) {
      const date = new Date(now - (days - 1 - i) * DAY_MS);
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

// =========================
// NEW: ANALYTICS PAGE QUERIES
// =========================

export const kpis = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, saleItems, itemsBySale } = await loadStoreSalesData(
      ctx,
      args.storeId
    );

    const now = Date.now();
    const todayStart = startOfDay(now);
    const yesterdayStart = todayStart - DAY_MS;
    const weekStart = startOfWeek(now);
    const thisMonthStart = startOfMonth(now);
    const lastMonthStart = addMonths(thisMonthStart, -1);

    const sumRevenue = (from: number, to: number) =>
      sales
        .filter((s: any) => s.createdAt >= from && s.createdAt < to)
        .reduce((sum: number, s: any) => sum + saleRevenue(s, itemsBySale), 0);

    const todayRevenue = sumRevenue(todayStart, todayStart + DAY_MS);
    const yesterdayRevenue = sumRevenue(yesterdayStart, todayStart);
    const weekRevenue = sumRevenue(weekStart, now + 1);
    const monthRevenue = sumRevenue(thisMonthStart, now + 1);
    const lastMonthRevenue = sumRevenue(lastMonthStart, thisMonthStart);
    const totalRevenue = sales.reduce(
      (sum: number, s: any) => sum + saleRevenue(s, itemsBySale),
      0
    );

    const totalOrders = sales.length;
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Units sold today (from saleItems via sales today)
    const todaysSaleIds = new Set(
      sales
        .filter(
          (s: any) =>
            s.createdAt >= todayStart && s.createdAt < todayStart + DAY_MS
        )
        .map((s: any) => String(s._id))
    );
    let unitsSoldToday = 0;
    for (const item of saleItems) {
      if (todaysSaleIds.has(String(item.saleId))) {
        unitsSoldToday += itemUnits(item);
      }
    }

    // Best & lowest selling product (by total units, all-time, only products with at least 1 unit)
    const productUnits: Record<string, { name: string; units: number }> = {};
    for (const item of saleItems) {
      const key = String(item.productId);
      if (!productUnits[key]) {
        productUnits[key] = { name: item.productName, units: 0 };
      }
      productUnits[key].units += itemUnits(item);
    }
    const productEntries = Object.entries(productUnits).filter(
      ([, v]) => v.units > 0
    );
    productEntries.sort((a, b) => b[1].units - a[1].units);
    const bestSellingProduct =
      productEntries.length > 0
        ? {
            id: productEntries[0][0],
            name: productEntries[0][1].name,
            units: productEntries[0][1].units,
          }
        : null;
    const lowestSellingProduct =
      productEntries.length > 0
        ? {
            id: productEntries[productEntries.length - 1][0],
            name: productEntries[productEntries.length - 1][1].name,
            units: productEntries[productEntries.length - 1][1].units,
          }
        : null;

    const growthVsYesterdayPct =
      yesterdayRevenue > 0
        ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100
        : null;
    const growthVsLastMonthPct =
      lastMonthRevenue > 0
        ? ((monthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
        : null;

    return {
      todayRevenue,
      yesterdayRevenue,
      weekRevenue,
      monthRevenue,
      totalRevenue,
      totalOrders,
      avgOrderValue,
      bestSellingProduct,
      lowestSellingProduct,
      unitsSoldToday,
      growthVsYesterdayPct,
      growthVsLastMonthPct,
    };
  },
});

export const dailyRevenue = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rangeStart: v.float64(),
    rangeEnd: v.float64(),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const buckets: Record<string, { revenue: number; orders: number }> = {};
    for (
      let t = startOfDay(args.rangeStart);
      t < args.rangeEnd;
      t += DAY_MS
    ) {
      buckets[dayKey(t)] = { revenue: 0, orders: 0 };
    }

    for (const sale of sales) {
      if (sale.createdAt < args.rangeStart || sale.createdAt >= args.rangeEnd)
        continue;
      const key = dayKey(sale.createdAt);
      if (!buckets[key]) continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      const filtered = args.productId
        ? items.filter((i: any) => i.productId === args.productId)
        : items;
      if (args.productId && filtered.length === 0) continue;
      buckets[key].revenue += filtered.reduce(
        (s: number, i: any) => s + itemRevenue(i),
        0
      );
      buckets[key].orders += 1;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({ date, ...v }));
  },
});

export const weeklyRevenue = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const now = Date.now();
    const buckets: Record<string, number> = {};
    const weekStarts: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const ws = startOfWeek(now - i * 7 * DAY_MS);
      weekStarts.push(ws);
      buckets[String(ws)] = 0;
    }
    const earliest = weekStarts[0];

    for (const sale of sales) {
      if (sale.createdAt < earliest) continue;
      const ws = startOfWeek(sale.createdAt);
      const key = String(ws);
      if (!(key in buckets)) continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      const filtered = args.productId
        ? items.filter((i: any) => i.productId === args.productId)
        : items;
      buckets[key] += filtered.reduce(
        (s: number, i: any) => s + itemRevenue(i),
        0
      );
    }

    return weekStarts.map((ws) => ({
      weekStart: dayKey(ws),
      label: new Date(ws).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      revenue: buckets[String(ws)],
    }));
  },
});

export const monthlyRevenue = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const now = Date.now();
    const thisMonth = startOfMonth(now);
    const months: number[] = [];
    for (let i = 11; i >= 0; i--) months.push(addMonths(thisMonth, -i));
    const earliest = months[0];
    const buckets: Record<string, number> = {};
    for (const m of months) buckets[monthKey(m)] = 0;

    for (const sale of sales) {
      if (sale.createdAt < earliest) continue;
      const key = monthKey(sale.createdAt);
      if (!(key in buckets)) continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      const filtered = args.productId
        ? items.filter((i: any) => i.productId === args.productId)
        : items;
      buckets[key] += filtered.reduce(
        (s: number, i: any) => s + itemRevenue(i),
        0
      );
    }

    return months.map((m) => ({
      month: monthKey(m),
      label: new Date(m).toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      }),
      revenue: buckets[monthKey(m)],
    }));
  },
});

export const topProductsRanked = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rangeStart: v.float64(),
    rangeEnd: v.float64(),
    productId: v.optional(v.id("products")),
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

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const totals: Record<
      string,
      { name: string; qtySold: number; revenue: number; orders: Set<string> }
    > = {};

    for (const sale of sales) {
      if (sale.createdAt < args.rangeStart || sale.createdAt >= args.rangeEnd)
        continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      for (const item of items) {
        if (args.productId && item.productId !== args.productId) continue;
        const key = String(item.productId);
        if (!totals[key]) {
          totals[key] = {
            name: item.productName,
            qtySold: 0,
            revenue: 0,
            orders: new Set(),
          };
        }
        totals[key].qtySold += itemUnits(item);
        totals[key].revenue += itemRevenue(item);
        totals[key].orders.add(String(sale._id));
      }
    }

    const limit = args.limit ?? 10;
    return Object.entries(totals)
      .map(([productId, t]) => ({
        productId,
        name: t.name,
        qtySold: t.qtySold,
        revenue: t.revenue,
        orderCount: t.orders.size,
      }))
      .filter((p) => p.qtySold > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  },
});

export const productShare = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rangeStart: v.float64(),
    rangeEnd: v.float64(),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const totals: Record<string, { name: string; revenue: number }> = {};
    for (const sale of sales) {
      if (sale.createdAt < args.rangeStart || sale.createdAt >= args.rangeEnd)
        continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      for (const item of items) {
        const key = String(item.productId);
        if (!totals[key]) totals[key] = { name: item.productName, revenue: 0 };
        totals[key].revenue += itemRevenue(item);
      }
    }

    const sorted = Object.values(totals)
      .filter((t) => t.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    const top = sorted.slice(0, 6);
    const others = sorted.slice(6);
    if (others.length > 0) {
      top.push({
        name: "Other",
        revenue: others.reduce((s: number, t: any) => s + t.revenue, 0),
      });
    }
    const total = top.reduce((s: number, t: any) => s + t.revenue, 0);
    return top.map((t) => ({
      name: t.name,
      revenue: t.revenue,
      pct: total > 0 ? (t.revenue / total) * 100 : 0,
    }));
  },
});

export const quantityTrend = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rangeStart: v.float64(),
    rangeEnd: v.float64(),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const buckets: Record<string, number> = {};
    for (
      let t = startOfDay(args.rangeStart);
      t < args.rangeEnd;
      t += DAY_MS
    ) {
      buckets[dayKey(t)] = 0;
    }

    for (const sale of sales) {
      if (sale.createdAt < args.rangeStart || sale.createdAt >= args.rangeEnd)
        continue;
      const key = dayKey(sale.createdAt);
      if (!(key in buckets)) continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      for (const item of items) {
        if (args.productId && item.productId !== args.productId) continue;
        buckets[key] += itemUnits(item);
      }
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, units]) => ({ date, units }));
  },
});

export const ordersByDayOfWeek = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rangeStart: v.float64(),
    rangeEnd: v.float64(),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const buckets = Array.from({ length: 7 }, () => ({ orders: 0, revenue: 0 }));

    for (const sale of sales) {
      if (sale.createdAt < args.rangeStart || sale.createdAt >= args.rangeEnd)
        continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      const filtered = args.productId
        ? items.filter((i: any) => i.productId === args.productId)
        : items;
      if (args.productId && filtered.length === 0) continue;
      const dow = new Date(sale.createdAt).getUTCDay();
      buckets[dow].orders += 1;
      buckets[dow].revenue += filtered.reduce(
        (s: number, i: any) => s + itemRevenue(i),
        0
      );
    }

    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return buckets.map((b, dow) => ({ dow, label: labels[dow], ...b }));
  },
});

export const insights = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, saleItems, itemsBySale } = await loadStoreSalesData(
      ctx,
      args.storeId
    );

    // Daily revenue map (all time)
    const dailyMap: Record<string, number> = {};
    for (const sale of sales) {
      const key = dayKey(sale.createdAt);
      const rev = saleRevenue(sale, itemsBySale);
      dailyMap[key] = (dailyMap[key] ?? 0) + rev;
    }
    const dailyEntries = Object.entries(dailyMap).filter(([, v]) => v > 0);
    dailyEntries.sort((a, b) => b[1] - a[1]);
    const highestSalesDay =
      dailyEntries.length > 0
        ? { date: dailyEntries[0][0], revenue: dailyEntries[0][1] }
        : null;
    const lowestSalesDay =
      dailyEntries.length > 0
        ? {
            date: dailyEntries[dailyEntries.length - 1][0],
            revenue: dailyEntries[dailyEntries.length - 1][1],
          }
        : null;

    // Top revenue product (all time)
    const productRev: Record<
      string,
      { name: string; revenue: number; recent: number; prior: number; units: number }
    > = {};
    const now = Date.now();
    const recentStart = now - 30 * DAY_MS;
    const priorStart = now - 60 * DAY_MS;

    for (const item of saleItems) {
      const key = String(item.productId);
      if (!productRev[key]) {
        productRev[key] = {
          name: item.productName,
          revenue: 0,
          recent: 0,
          prior: 0,
          units: 0,
        };
      }
      productRev[key].revenue += itemRevenue(item);
      productRev[key].units += itemUnits(item);

      // Find sale's createdAt to bucket recent/prior
      // saleItems link by saleId; precompute sale createdAt map
    }
    // build sale createdAt map
    const saleCreated: Record<string, number> = {};
    for (const s of sales) saleCreated[String(s._id)] = (s as any).createdAt;
    for (const item of saleItems) {
      const created = saleCreated[String(item.saleId)] ?? 0;
      const key = String(item.productId);
      if (!productRev[key]) continue;
      if (created >= recentStart) {
        productRev[key].recent += itemRevenue(item);
      } else if (created >= priorStart) {
        productRev[key].prior += itemRevenue(item);
      }
    }

    const productEntries = Object.entries(productRev).filter(
      ([, v]) => v.revenue > 0
    );
    productEntries.sort((a, b) => b[1].revenue - a[1].revenue);
    const topRevenueProduct =
      productEntries.length > 0
        ? { name: productEntries[0][1].name, revenue: productEntries[0][1].revenue }
        : null;

    // Fastest growing: largest positive % change recent vs prior with min 3 units recent
    const growth = productEntries
      .filter(([, v]) => v.prior > 0 && v.recent > 0)
      .map(([id, v]) => ({
        id,
        name: v.name,
        pct: ((v.recent - v.prior) / v.prior) * 100,
      }))
      .filter((g) => g.pct > 0)
      .sort((a, b) => b.pct - a.pct);
    const fastestGrowingProduct = growth.length > 0 ? growth[0] : null;

    // Slow-moving products: active products with <=2 units sold in last 30 days
    const products = await ctx.db
      .query("products")
      .withIndex("by_store_and_archived", (q: any) =>
        q.eq("storeId", args.storeId).eq("isArchived", false)
      )
      .collect();
    const recentUnits: Record<string, number> = {};
    for (const item of saleItems) {
      const created = saleCreated[String(item.saleId)] ?? 0;
      if (created < recentStart) continue;
      recentUnits[String(item.productId)] =
        (recentUnits[String(item.productId)] ?? 0) + itemUnits(item);
    }
    const slowMoving = products
      .map((p: any) => ({
        id: String(p._id),
        name: p.name,
        units: recentUnits[String(p._id)] ?? 0,
      }))
      .filter((p) => p.units <= 2)
      .sort((a, b) => a.units - b.units)
      .slice(0, 5);

    // Recent trend: revenue last 7d vs prior 7d
    const last7Start = now - 7 * DAY_MS;
    const prior7Start = now - 14 * DAY_MS;
    let last7 = 0;
    let prior7 = 0;
    for (const sale of sales) {
      const rev = saleRevenue(sale, itemsBySale);
      if (sale.createdAt >= last7Start) last7 += rev;
      else if (sale.createdAt >= prior7Start) prior7 += rev;
    }
    const recentTrendPct =
      prior7 > 0 ? ((last7 - prior7) / prior7) * 100 : null;

    // Averages
    const totalRevenue = sales.reduce(
      (s: number, sale: any) => s + saleRevenue(sale, itemsBySale),
      0
    );
    const dayCount = Object.keys(dailyMap).length || 1;
    const avgDailyRevenue = totalRevenue / dayCount;
    const monthSet = new Set(sales.map((s: any) => monthKey(s.createdAt)));
    const monthCount = Math.max(monthSet.size, 1);
    const avgMonthlyRevenue = totalRevenue / monthCount;

    return {
      highestSalesDay,
      lowestSalesDay,
      topRevenueProduct,
      fastestGrowingProduct,
      slowMovingProducts: slowMoving,
      recentTrendPct,
      avgDailyRevenue,
      avgMonthlyRevenue,
    };
  },
});

export const dailySummary = query({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    rangeStart: v.float64(),
    rangeEnd: v.float64(),
    productId: v.optional(v.id("products")),
  },
  handler: async (ctx, args) => {
    await assertStorePermission(
      ctx.db,
      args.userId,
      args.storeId,
      "analytics",
      "view"
    );

    const { sales, itemsBySale } = await loadStoreSalesData(ctx, args.storeId);

    const buckets: Record<string, { orders: number; revenue: number }> = {};
    for (
      let t = startOfDay(args.rangeStart);
      t < args.rangeEnd;
      t += DAY_MS
    ) {
      buckets[dayKey(t)] = { orders: 0, revenue: 0 };
    }

    for (const sale of sales) {
      if (sale.createdAt < args.rangeStart || sale.createdAt >= args.rangeEnd)
        continue;
      const key = dayKey(sale.createdAt);
      if (!(key in buckets)) continue;
      const items = itemsBySale[String(sale._id)] ?? [];
      const filtered = args.productId
        ? items.filter((i: any) => i.productId === args.productId)
        : items;
      if (args.productId && filtered.length === 0) continue;
      buckets[key].revenue += filtered.reduce(
        (s: number, i: any) => s + itemRevenue(i),
        0
      );
      buckets[key].orders += 1;
    }

    return Object.entries(buckets)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, v]) => ({
        date,
        orders: v.orders,
        revenue: v.revenue,
        avgOrderValue: v.orders > 0 ? v.revenue / v.orders : 0,
      }));
  },
});
