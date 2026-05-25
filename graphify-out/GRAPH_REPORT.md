# Graph Report - .  (2026-05-25)

## Corpus Check
- 67 files · ~99,999 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 632 nodes · 743 edges · 113 communities (93 shown, 20 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 46 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 100|Community 100]]
- [[_COMMUNITY_Community 101|Community 101]]
- [[_COMMUNITY_Community 102|Community 102]]
- [[_COMMUNITY_Community 103|Community 103]]
- [[_COMMUNITY_Community 104|Community 104]]
- [[_COMMUNITY_Community 105|Community 105]]
- [[_COMMUNITY_Community 106|Community 106]]
- [[_COMMUNITY_Community 107|Community 107]]
- [[_COMMUNITY_Community 108|Community 108]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]

## God Nodes (most connected - your core abstractions)
1. `friendlyMessage()` - 42 edges
2. `PageHeader()` - 23 edges
3. `requireCurrentUserId()` - 21 edges
4. `Customer-Linked Sales & Returns Design Spec` - 13 edges
5. `Ware-House Inventory & Sales Management SaaS` - 10 edges
6. `Inventory Import & Edit Fixes Design Spec` - 9 edges
7. `Analytics Page Design Spec` - 7 edges
8. `handleSubmit()` - 6 edges
9. `Convex AI Guidelines: function patterns, schema rules, auth, queries, mutations, actions, testing` - 6 edges
10. `getCurrentUserId()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `Stock Movement Invariant: all changes via adjustStock()` --semantically_similar_to--> `Convex Schema Rules: indexes include all fields in name, no unbounded arrays in docs`  [INFERRED] [semantically similar]
  CLAUDE.md → apps/web/convex/_generated/ai/guidelines.md
- `Auth Pattern: Clerk + Convex JWT` --semantically_similar_to--> `Convex Auth: tokenIdentifier over subject, never accept userId as arg, ConvexProviderWithAuth`  [INFERRED] [semantically similar]
  CLAUDE.md → apps/web/convex/_generated/ai/guidelines.md
- `Semantic Notes: top revenue not 'most profitable', fastest growing excludes <3 sales, returns reduce revenue` --references--> `Stock Movement Invariant: all changes via adjustStock()`  [INFERRED]
  docs/superpowers/specs/2026-04-26-analytics-page-design.md → CLAUDE.md
- `updateProfile()` --calls--> `requireCurrentUserId()`  [INFERRED]
  apps/web/app/actions/auth.ts → apps/web/lib/auth.ts
- `StoreLayout()` --calls--> `getCurrentUserId()`  [INFERRED]
  apps/web/app/(dashboard)/store/[storeId]/layout.tsx → apps/web/lib/auth.ts

## Hyperedges (group relationships)
- **** — cash_event_entity, store_drawer_entity, recordManualCash_mutation [INFERRED]
- **** — shift_entity, shift_disabled_gate, shift_drawer_entity [INFERRED]
- **** — exchange_rate_entity, sales_rate_gate, permission_check [INFERRED]

## Communities (113 total, 20 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (29): PageHeader(), PageHeaderProps, usePatternClass(), Topbar(), TopbarProps, DENSITIES, HEADER_STYLES, PATTERNS (+21 more)

### Community 1 - "Community 1"
Cohesion: 0.05
Nodes (40): archive, create, get, importRow, list, restore, update, create (+32 more)

### Community 2 - "Community 2"
Cohesion: 0.07
Nodes (27): convex, createCustomer(), acceptInvitation(), convex, createStore(), declineInvitation(), deleteStore(), inviteMember() (+19 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (31): adjustProductStock(), archiveProduct(), bulkImportProducts(), convex, createCategory(), createProduct(), ensureCategories(), parseOptionalPositive() (+23 more)

### Community 4 - "Community 4"
Cohesion: 0.09
Nodes (15): convex, createReturn(), Reason, convex, createSale(), createProduct(), CartItem, Currency (+7 more)

### Community 5 - "Community 5"
Cohesion: 0.1
Nodes (12): closeShift(), convex, openShift(), parseAmount(), recordCash(), reopenShift(), REASON_LABELS, ReasonBadge() (+4 more)

### Community 6 - "Community 6"
Cohesion: 0.1
Nodes (22): Audit Log Trail (for invitation revoke and cash actions), Cash Event, Cash Page Detached from Shifts (works independently), Cash detach, shift guard, invite revoke, rate gate, Cash detach, shift guard, invite revoke, rate gate Design Spec, computeStoreDrawer Helper Function, Exchange Rate (USD/LBP), getStoreDrawer Query (store-level drawer balance with permission gate) (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.15
Nodes (11): NavLink, Section, SECTIONS, Sidebar(), SidebarProps, StoreLayout(), buildEmptyPermissions(), NewRolePage() (+3 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (16): Customer-Linked Sales & Returns Implementation Plan (15 tasks), Plan Task 2: Convex customers.ts functions, Plan Task 10: Return form page, Plan Task 1: Schema — add customers, saleReturns, saleReturnItems, Inventory Import & Edit Fixes Implementation Plan (8 tasks), Customer-Linked Sales & Returns Design Spec, Convex customers.ts: list, getByPhone, create, Decisions Log: 9 design decisions with rationale (+8 more)

### Community 11 - "Community 11"
Cohesion: 0.22
Nodes (10): Plan Task 1: Add categories.ensureMany mutation, Plan Task 7: Fix import header matcher and resolve unknown categories, Plan Task 4: Extract NewCategoryDialog shared component, Inventory Import & Edit Fixes Design Spec, Fix 1: Auto-create unknown categories via categories.ensureMany mutation, Fix 4: Inline '+ New Category' dialog on edit page via shared NewCategoryDialog component, Fix 5: Tighten get() matcher to exact match (norm === t) instead of includes, Fix 3: Edit-page Category Select shows name (controlled value+state) (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.2
Nodes (8): DEFAULT_PERMISSIONS, FUNCTION_DEPENDENCIES, LOCKED_FUNCTIONS, PAGE_FUNCTIONS, PAGE_KEYS, PageKey, PagePermissions, StorePermissions

### Community 13 - "Community 13"
Cohesion: 0.29
Nodes (4): AuthResult, convex, updateProfile(), updateProfile()

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (8): Stock Movement Invariant: all changes via adjustStock(), Convex Schema Rules: indexes include all fields in name, no unbounded arrays in docs, Plan Task 5: Convex returns.ts functions, Plan Task 2: Add products.importRow mutation, Semantic Notes: top revenue not 'most profitable', fastest growing excludes <3 sales, returns reduce revenue, Convex returns.ts: listByStore, getBySale, get, create (10-step atomic flow), Rationale: Returns immutable to avoid rabbit hole of undo-a-return, Fix 2: Match-and-add for existing products — SKU→barcode→name strategy

### Community 16 - "Community 16"
Cohesion: 0.25
Nodes (8): Auth Pattern: Clerk + Convex JWT, Next.js 16 Breaking Changes: proxy.ts, shadcn v4 no asChild, Convex AI Guidelines: function patterns, schema rules, auth, queries, mutations, actions, testing, Convex Action Rules: use node directive, never ctx.db in actions, separate actions file, Convex Auth: tokenIdentifier over subject, never accept userId as arg, ConvexProviderWithAuth, Convex Query Rules: no filter(), use withIndex, no collect(), no .delete(), batch deletes, apps/web AGENTS.md: Next.js 16 breaking changes warning + Convex usage directive, apps/web CLAUDE.md: Convex usage directive (read guidelines.md first)

### Community 17 - "Community 17"
Cohesion: 0.29
Nodes (6): accept, create, decline, getByToken, listByStore, remove

### Community 18 - "Community 18"
Cohesion: 0.29
Nodes (5): create, list, listActive, remove, update

### Community 19 - "Community 19"
Cohesion: 0.29
Nodes (3): create, getByPhone, list

### Community 20 - "Community 20"
Cohesion: 0.52
Nodes (5): applyCustom(), endOfDay(), presetRange(), startOfDay(), startOfMonth()

### Community 21 - "Community 21"
Cohesion: 0.33
Nodes (3): inter, jetbrainsMono, metadata

### Community 22 - "Community 22"
Cohesion: 0.33
Nodes (5): create, deleteStore, getById, listByUser, update

### Community 23 - "Community 23"
Cohesion: 0.33
Nodes (5): backfillCurrency, backfillRolesV3, migrateRolesV2, splitCategoryPerms, wipeAll

### Community 24 - "Community 24"
Cohesion: 0.33
Nodes (5): current, getByClerkId, getById, store, updateProfile

### Community 25 - "Community 25"
Cohesion: 0.33
Nodes (5): create, ensureMany, list, remove, update

### Community 29 - "Community 29"
Cohesion: 0.33
Nodes (6): Convex helpers: audit.ts, permissions.ts, stock.ts, Monorepo Structure: Turborepo + npm workspaces, Route Map (22 routes), Tech Stack: Next.js 16, Convex, Clerk, Tailwind, shadcn v4, Ware-House Inventory & Sales Management SaaS, 3 new routes: sales/[saleId]/return, returns, returns/[returnId]

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (6): Analytics Page Design Spec, Analytics Architecture: server page + client AnalyticsView with filter state + useQuery, Analytics Components: analytics-view, kpi-card/grid, range-filter, product-filter, insights-section, tables, export-csv-button, charts/*, Analytics Convex API: 9 queries (kpis, dailyRevenue, weeklyRevenue, monthlyRevenue, topProducts, productShare, quantitySoldTrend, ordersByDayOfWeek, insights, dailySummary), Analytics Goal: professional real-time analytics for store owners (KPIs, charts, insights, tables), Rationale: filter state in component state, URL sync deferred

### Community 33 - "Community 33"
Cohesion: 0.4
Nodes (4): list, markAllAsRead, markAsRead, unreadCount

### Community 35 - "Community 35"
Cohesion: 0.5
Nodes (3): listByStore, remove, updateRole

### Community 37 - "Community 37"
Cohesion: 0.83
Nodes (3): assertStoreMember(), assertStorePermission(), getStoreMember()

## Knowledge Gaps
- **177 isolated node(s):** `Tech Stack: Next.js 16, Convex, Clerk, Tailwind, shadcn v4`, `Monorepo Structure: Turborepo + npm workspaces`, `Convex helpers: audit.ts, permissions.ts, stock.ts`, `Plan Task 2: Convex customers.ts functions`, `Plan Task 3: Server actions (customers, sales, returns)` (+172 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **20 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `friendlyMessage()` connect `Community 2` to `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 13`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `PageHeader()` connect `Community 0` to `Community 2`, `Community 3`, `Community 4`, `Community 5`, `Community 7`, `Community 13`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `requireCurrentUserId()` connect `Community 3` to `Community 2`, `Community 4`, `Community 13`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `requireCurrentUserId()` (e.g. with `createProduct()` and `updateProduct()`) actually correct?**
  _`requireCurrentUserId()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Customer-Linked Sales & Returns Design Spec` (e.g. with `Plan Task 10: Return form page` and `Analytics Page Design Spec`) actually correct?**
  _`Customer-Linked Sales & Returns Design Spec` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Tech Stack: Next.js 16, Convex, Clerk, Tailwind, shadcn v4`, `Monorepo Structure: Turborepo + npm workspaces`, `Convex helpers: audit.ts, permissions.ts, stock.ts` to the rest of the system?**
  _177 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._