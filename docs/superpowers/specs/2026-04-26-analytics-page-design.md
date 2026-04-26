# Analytics Page — Design Spec

**Date:** 2026-04-26
**Status:** Approved (pending implementation)
**Route:** `/store/[storeId]/analytics`

## Goal

Build a professional, real-time analytics page for store owners and managers that surfaces sales performance through KPI cards, charts, insights, and tables. The existing landing dashboard at `/store/[storeId]` stays as a quick-glance overview; this new page is the deep-dive.

## Scope

**In scope (this spec):**
- KPI grid (12 metrics)
- 7 charts (daily revenue, weekly revenue, monthly revenue, top products bar, product share pie, quantity trend, orders by day of week)
- Filter bar (Today, 7d, 30d, This Month, Custom range, Product)
- Insights section (8 cards)
- Top Products table + Daily Summary table (sortable)
- CSV export of Daily Summary
- Real-time auto-refresh via Convex subscriptions
- Dark mode + responsive

**Deferred (future phase):**
- PDF export, print
- Chart image download
- Revenue forecast (next 7 days)
- Peak selling hours
- Dedicated month-vs-month comparison view

## Architecture

### Route
- Server component at `apps/web/app/(dashboard)/store/[storeId]/analytics/page.tsx`
  - Resolves store, asserts `permissions.analytics !== "none"`, calls `notFound()` on denial
  - Renders client `<AnalyticsView storeId={storeId} />`
- Client `AnalyticsView` owns filter state and runs all `useQuery` calls

### Data flow
- Convex queries are reactive — any new sale through `sales.create` causes dependent queries to re-run, updating the UI live without polling.
- Filter state held in component state (`useState`); URL sync deferred.

## Convex API (extends `convex/analytics.ts`)

All queries are store-scoped and assert membership.

| Query | Args | Returns |
|---|---|---|
| `kpis` | `{ storeId }` | `{ todayRevenue, yesterdayRevenue, weekRevenue, monthRevenue, totalRevenue, totalOrders, avgOrderValue, bestSellingProduct: {id, name, units}, lowestSellingProduct: {id, name, units}, unitsSoldToday, growthVsYesterdayPct, growthVsLastMonthPct }` |
| `dailyRevenue` | `{ storeId, rangeStart, rangeEnd, productId? }` | `Array<{ date: string, revenue: number, orders: number }>` |
| `weeklyRevenue` | `{ storeId, productId? }` | last 12 weeks `{ weekStart, revenue }` |
| `monthlyRevenue` | `{ storeId, productId? }` | last 12 months `{ month: "YYYY-MM", revenue }` |
| `topProducts` | `{ storeId, rangeStart, rangeEnd, productId?, limit? }` | `{ productId, name, qtySold, revenue, orderCount }[]` |
| `productShare` | `{ storeId, rangeStart, rangeEnd }` | top 6 + "Other" `{ name, revenue, pct }` |
| `quantitySoldTrend` | `{ storeId, rangeStart, rangeEnd, productId? }` | `{ date, units }[]` |
| `ordersByDayOfWeek` | `{ storeId, rangeStart, rangeEnd, productId? }` | `{ dow: 0..6, orders, revenue }[]` |
| `insights` | `{ storeId, productId? }` | `{ highestSalesDay, lowestSalesDay, topRevenueProduct, fastestGrowingProduct, slowMovingProducts, recentTrend, avgDailyRevenue, avgMonthlyRevenue }` |
| `dailySummary` | `{ storeId, rangeStart, rangeEnd, productId? }` | `{ date, orders, revenue, avgOrderValue }[]` |

### Semantic notes
- **"Most profitable product"** is rendered as **"Top Revenue Product"** because cost data is not stored; only price is. This is shown explicitly in the UI label to avoid implying margin tracking.
- **"Fastest growing product"** = product with the largest positive % change in revenue (last 30d vs previous 30d). Products with fewer than 3 sales in either window are excluded to filter noise.
- **"Slow moving products"** = active (non-archived) products with 0 or `<= 2` units sold in the last 30 days.
- **Returns** reduce a sale's effective revenue: `revenue = sum(line.priceCents * (qty - returnedQuantity))`. All queries must apply this consistently.

## UI Layout

```
Header: "Analytics" + Filter Bar
  Presets: [Today] [7d] [30d ✓] [This Month] [Custom ⌄] [Product ⌄] [Export CSV]

KPI Grid (4 / 2 / 1 cols)
  12 cards. Growth cards show ↑ green / ↓ red / — blue.

Daily Revenue (full-width line chart, range-driven)
Weekly Revenue (bar) | Monthly Revenue (bar)
Top Selling Products (horiz bar) | Product Share (pie)
Quantity Sold Trend (line) | Orders by Day of Week (bar)

Insights Section (3-col card grid, 8 insight cards)

Top Products Table (sortable) | Daily Summary Table (sortable + paginated)
```

### Filter behavior
- KPI cards are **independent** of the filter — they show fixed absolute periods (today, this week, this month, all time, etc.)
- Charts, insights, and tables **respect** the filter
- Product filter narrows charts/insights/tables to a single product's contribution
- Default range: **Last 30 days**

### KPI card list
1. Today Revenue
2. Yesterday Revenue
3. This Week Revenue
4. This Month Revenue
5. Total Revenue
6. Total Orders
7. Average Order Value
8. Best Selling Product (name + units)
9. Lowest Selling Product (name + units)
10. Units Sold Today
11. Growth % vs Yesterday
12. Growth % vs Last Month

## Components

New under `apps/web/components/analytics/`:

- `analytics-view.tsx` — client orchestrator: filter state + all `useQuery` calls + section composition
- `kpi-card.tsx` — label, value, optional trend (% + colored arrow icon), tooltip
- `kpi-grid.tsx` — renders the 12 cards
- `range-filter.tsx` — preset buttons + custom range popover (uses `react-day-picker` via existing shadcn calendar)
- `product-filter.tsx` — searchable combobox over `api.products.list`
- `insights-section.tsx` — 8 cards from `insights` query
- `top-products-table.tsx` — sortable header click, reuses `components/ui/table.tsx`
- `daily-summary-table.tsx` — sortable + simple page-size 30 pagination
- `export-csv-button.tsx` — generates CSV from current `dailySummary` data via `Blob` + anchor download (no dependency)
- `charts/daily-revenue.tsx`
- `charts/weekly-revenue.tsx`
- `charts/monthly-revenue.tsx`
- `charts/top-products-bar.tsx`
- `charts/product-share-pie.tsx`
- `charts/quantity-trend.tsx`
- `charts/dow-orders.tsx`

Each chart file is ~60 lines, accepts typed `data` as prop, uses existing `components/ui/chart.tsx` (shadcn + recharts) and `--chart-1` … `--chart-5` CSS variables for themed colors.

## Permissions

- Server-side check in `page.tsx`: `permissions.analytics !== "none"` → `notFound()` if denied
- Sidebar link already gated; no change needed there
- Convex queries each call `assertStoreMember(ctx, storeId, userId)` from `_helpers/permissions.ts`

## Styling & Responsiveness

- Tailwind dark mode variants used throughout (project already configured)
- KPI grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Chart rows: `grid-cols-1 lg:grid-cols-2`
- Tables: stacked on mobile, side-by-side on `lg:`
- Hover states use existing shadcn card hover utilities; no custom animation framework

## Color Coding

- Growth indicators: `text-emerald-500` (positive), `text-rose-500` (negative), `text-muted-foreground` (zero/neutral)
- Charts pull palette from CSS variables `--chart-1` through `--chart-5` (already defined in `globals.css`)

## Edge Cases

- **No sales yet:** all queries return zero/empty arrays; UI shows empty-state messages per section, not crashes
- **Single sale:** growth % vs yesterday/last month displays "—" when prior period has zero revenue (avoid divide-by-zero / Infinity)
- **Returned sales:** revenue computed from `qty - returnedQuantity` consistently across all queries
- **Archived products:** included in historical revenue/insight queries; excluded from "slow moving products" eligibility
- **Custom date range:** `rangeEnd` is exclusive end-of-day in store's timezone (UTC for v1; timezone-awareness deferred)

## Testing

- Build verification: `npx next build` from `apps/web` must succeed (target: 22 routes total)
- Manual smoke test plan:
  1. Land on page with empty store → verify empty states
  2. Create sales → verify KPIs update live without refresh
  3. Toggle each filter preset → verify charts/tables update, KPIs do not
  4. Apply custom range and product filter → verify scoping
  5. Export CSV → verify file downloads with correct columns
  6. Toggle dark mode → verify chart legibility
  7. Resize to mobile width → verify single-column stacking

## Out of Scope

- PDF export, print stylesheet
- Chart-as-image download
- Revenue forecast (would require a forecasting helper — separate spec)
- Peak selling hours (requires hour-of-day bucketing — separate spec)
- Dedicated comparison view (covered by growth % cards for v1)
- Timezone-aware bucketing (UTC for v1)

## File Manifest

**New files:**
- `apps/web/app/(dashboard)/store/[storeId]/analytics/page.tsx`
- `apps/web/components/analytics/analytics-view.tsx`
- `apps/web/components/analytics/kpi-card.tsx`
- `apps/web/components/analytics/kpi-grid.tsx`
- `apps/web/components/analytics/range-filter.tsx`
- `apps/web/components/analytics/product-filter.tsx`
- `apps/web/components/analytics/insights-section.tsx`
- `apps/web/components/analytics/top-products-table.tsx`
- `apps/web/components/analytics/daily-summary-table.tsx`
- `apps/web/components/analytics/export-csv-button.tsx`
- `apps/web/components/analytics/charts/{daily-revenue,weekly-revenue,monthly-revenue,top-products-bar,product-share-pie,quantity-trend,dow-orders}.tsx`

**Modified files:**
- `apps/web/convex/analytics.ts` — add 9 new queries (existing `overview`, `topProducts`, `salesTrend` stay for the landing dashboard or become the foundation; will be reconciled during implementation)
