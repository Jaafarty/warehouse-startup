# Graph Report - .  (2026-05-27)

## Corpus Check
- 180 files · ~0 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 654 nodes · 751 edges · 123 communities (98 shown, 25 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 35 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_storeIdcash|[storeId]/cash]]
- [[_COMMUNITY_componentslanding|components/landing]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_appactions|app/actions]]
- [[_COMMUNITY_componentslayout|components/layout]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY_appactions|app/actions]]
- [[_COMMUNITY_appactions|app/actions]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY_salesnew|sales/new]]
- [[_COMMUNITY_appactions|app/actions]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_srcconstants|src/constants]]
- [[_COMMUNITY_returnsreturnId|returns/[returnId]]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY__generatedai|_generated/ai]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_componentsanalytics|components/analytics]]
- [[_COMMUNITY_webapp|web/app]]
- [[_COMMUNITY_appactions|app/actions]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_CLAUDE|CLAUDE.md]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY_storeIdinventory|[storeId]/inventory]]
- [[_COMMUNITY_(dashboard)notifications|(dashboard)/notifications]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_storeIdanalytics|[storeId]/analytics]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_webconvex|web/convex]]
- [[_COMMUNITY_convex_helpers|convex/_helpers]]
- [[_COMMUNITY_componentsui|components/ui]]
- [[_COMMUNITY_webcomponents|web/components]]
- [[_COMMUNITY_rolesnew|roles/new]]
- [[_COMMUNITY_weblib|web/lib]]
- [[_COMMUNITY_storeIdreturns|[storeId]/returns]]
- [[_COMMUNITY_componentsanalytics|components/analytics]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY_superpowersplans|superpowers/plans]]
- [[_COMMUNITY_superpowersplans|superpowers/plans]]
- [[_COMMUNITY_superpowersplans|superpowers/plans]]
- [[_COMMUNITY_superpowersplans|superpowers/plans]]
- [[_COMMUNITY_superpowersplans|superpowers/plans]]
- [[_COMMUNITY_superpowersplans|superpowers/plans]]
- [[_COMMUNITY_superpowersspecs|superpowers/specs]]
- [[_COMMUNITY_appsweb|apps/web]]
- [[_COMMUNITY_webpublic|web/public]]
- [[_COMMUNITY_webpublic|web/public]]
- [[_COMMUNITY_webpublic|web/public]]
- [[_COMMUNITY_webpublic|web/public]]
- [[_COMMUNITY_webpublic|web/public]]

## God Nodes (most connected - your core abstractions)
1. `friendlyMessage()` - 36 edges
2. `requireCurrentUserId()` - 21 edges
3. `Customer-Linked Sales & Returns Design Spec` - 13 edges
4. `PageHeader()` - 12 edges
5. `Container()` - 11 edges
6. `Ware-House Inventory & Sales Management SaaS` - 10 edges
7. `Inventory Import & Edit Fixes Design Spec` - 9 edges
8. `Reveal()` - 9 edges
9. `Display()` - 8 edges
10. `Analytics Page Design Spec` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Stock Movement Invariant: all changes via adjustStock()` --semantically_similar_to--> `Convex Schema Rules: indexes include all fields in name, no unbounded arrays in docs`  [INFERRED] [semantically similar]
  CLAUDE.md → apps/web/convex/_generated/ai/guidelines.md
- `Auth Pattern: Clerk + Convex JWT` --semantically_similar_to--> `Convex Auth: tokenIdentifier over subject, never accept userId as arg, ConvexProviderWithAuth`  [INFERRED] [semantically similar]
  CLAUDE.md → apps/web/convex/_generated/ai/guidelines.md
- `Stock Movement Invariant: all changes via adjustStock()` --references--> `Semantic Notes: top revenue not 'most profitable', fastest growing excludes <3 sales, returns reduce revenue`  [INFERRED]
  CLAUDE.md → docs/superpowers/specs/2026-04-26-analytics-page-design.md
- `updateProfile()` --calls--> `requireCurrentUserId()`  [INFERRED]
  apps/web/app/actions/auth.ts → apps/web/lib/auth.ts
- `Ware-House Inventory & Sales Management SaaS` --references--> `Customer-Linked Sales & Returns Design Spec`  [EXTRACTED]
  CLAUDE.md → docs/superpowers/specs/2026-04-28-customer-returns-design.md

## Hyperedges (group relationships)
- **** — cash_event_entity, store_drawer_entity, recordManualCash_mutation [INFERRED]
- **** — shift_entity, shift_disabled_gate, shift_drawer_entity [INFERRED]
- **** — exchange_rate_entity, sales_rate_gate, permission_check [INFERRED]

## Communities (123 total, 25 thin omitted)

### Community 0 - "[storeId]/cash"
Cohesion: 0.05
Nodes (21): closeShift(), convex, openShift(), parseAmount(), recordCash(), reopenShift(), REASON_LABELS, ReasonBadge() (+13 more)

### Community 1 - "components/landing"
Cohesion: 0.09
Nodes (32): display, Bento(), FinalCta(), Faq(), FAQS, Features(), COLUMNS, Footer() (+24 more)

### Community 2 - "web/convex"
Cohesion: 0.05
Nodes (40): backfillCurrency, backfillRolesV3, dropLegacyCashId, migrateRolesV2, splitCategoryPerms, wipeAll, create, list (+32 more)

### Community 3 - "app/actions"
Cohesion: 0.11
Nodes (22): adjustProductStock(), bulkImportProducts(), convex, createCategory(), createProduct(), ensureCategories(), parseOptionalPositive(), updateProduct() (+14 more)

### Community 4 - "components/layout"
Cohesion: 0.11
Nodes (16): NavLink, Section, SECTIONS, Sidebar(), SidebarProps, StoreSwitcher(), StoreSwitcherProps, buildCrumbs() (+8 more)

### Community 5 - "superpowers/specs"
Cohesion: 0.1
Nodes (22): Audit Log Trail (for invitation revoke and cash actions), Cash Event, Cash Page Detached from Shifts (works independently), Cash detach, shift guard, invite revoke, rate gate, Cash detach, shift guard, invite revoke, rate gate Design Spec, computeStoreDrawer Helper Function, Exchange Rate (USD/LBP), getStoreDrawer Query (store-level drawer balance with permission gate) (+14 more)

### Community 6 - "app/actions"
Cohesion: 0.2
Nodes (13): acceptInvitation(), convex, createStore(), declineInvitation(), deleteStore(), inviteMember(), removeMember(), revokeInvitation() (+5 more)

### Community 7 - "app/actions"
Cohesion: 0.11
Nodes (8): AuthResult, convex, updateProfile(), updateProfile(), DashboardError(), looksNoisy(), NOISE_MARKERS, unwrapEmbeddedConvexError()

### Community 8 - "web/convex"
Cohesion: 0.15
Nodes (11): archive, create, get, importRow, list, restore, update, listByProduct (+3 more)

### Community 9 - "superpowers/specs"
Cohesion: 0.16
Nodes (14): Plan Task 2: Convex customers.ts functions, Plan Task 10: Return form page, Plan Task 1: Schema — add customers, saleReturns, saleReturnItems, Customer-Linked Sales & Returns Design Spec, Convex customers.ts: list, getByPhone, create, Decisions Log: 9 design decisions with rationale, Goals: customer linkage, searchable sales, first-class return records, dedicated return page, Problem: no customer on sales, returns not first-class, bad return UX (+6 more)

### Community 10 - "sales/new"
Cohesion: 0.16
Nodes (7): convex, createSale(), CartItem, Currency, unitPriceFor(), unitPriceUSDFor(), createSale()

### Community 11 - "app/actions"
Cohesion: 0.18
Nodes (8): convex, createReturn(), Reason, createProduct(), handleSubmit(), Reason, REASONS, createReturn()

### Community 12 - "superpowers/specs"
Cohesion: 0.18
Nodes (12): Customer-Linked Sales & Returns Implementation Plan (15 tasks), Inventory Import & Edit Fixes Implementation Plan (8 tasks), Plan Task 1: Add categories.ensureMany mutation, Plan Task 7: Fix import header matcher and resolve unknown categories, Plan Task 4: Extract NewCategoryDialog shared component, Inventory Import & Edit Fixes Design Spec, Fix 1: Auto-create unknown categories via categories.ensureMany mutation, Fix 4: Inline '+ New Category' dialog on edit page via shared NewCategoryDialog component (+4 more)

### Community 15 - "src/constants"
Cohesion: 0.2
Nodes (8): DEFAULT_PERMISSIONS, FUNCTION_DEPENDENCIES, LOCKED_FUNCTIONS, PAGE_FUNCTIONS, PAGE_KEYS, PageKey, PagePermissions, StorePermissions

### Community 16 - "returns/[returnId]"
Cohesion: 0.25
Nodes (4): formatDate(), REASON_LABEL, REASON_LABEL, STATUS_VARIANT

### Community 18 - "superpowers/specs"
Cohesion: 0.25
Nodes (8): Stock Movement Invariant: all changes via adjustStock(), Convex Schema Rules: indexes include all fields in name, no unbounded arrays in docs, Plan Task 5: Convex returns.ts functions, Plan Task 2: Add products.importRow mutation, Semantic Notes: top revenue not 'most profitable', fastest growing excludes <3 sales, returns reduce revenue, Convex returns.ts: listByStore, getBySale, get, create (10-step atomic flow), Rationale: Returns immutable to avoid rabbit hole of undo-a-return, Fix 2: Match-and-add for existing products — SKU→barcode→name strategy

### Community 19 - "_generated/ai"
Cohesion: 0.25
Nodes (8): Auth Pattern: Clerk + Convex JWT, Next.js 16 Breaking Changes: proxy.ts, shadcn v4 no asChild, Convex AI Guidelines: function patterns, schema rules, auth, queries, mutations, actions, testing, Convex Action Rules: use node directive, never ctx.db in actions, separate actions file, Convex Auth: tokenIdentifier over subject, never accept userId as arg, ConvexProviderWithAuth, Convex Query Rules: no filter(), use withIndex, no collect(), no .delete(), batch deletes, apps/web AGENTS.md: Next.js 16 breaking changes warning + Convex usage directive, apps/web CLAUDE.md: Convex usage directive (read guidelines.md first)

### Community 20 - "web/convex"
Cohesion: 0.29
Nodes (6): accept, create, decline, getByToken, listByStore, remove

### Community 21 - "components/analytics"
Cohesion: 0.52
Nodes (5): applyCustom(), endOfDay(), presetRange(), startOfDay(), startOfMonth()

### Community 22 - "web/app"
Cohesion: 0.33
Nodes (3): inter, jetbrainsMono, metadata

### Community 23 - "app/actions"
Cohesion: 0.33
Nodes (4): convex, createCustomer(), handleCreate(), createCustomer()

### Community 24 - "web/convex"
Cohesion: 0.33
Nodes (5): create, deleteStore, getById, listByUser, update

### Community 25 - "web/convex"
Cohesion: 0.33
Nodes (5): create, ensureMany, list, remove, update

### Community 26 - "web/convex"
Cohesion: 0.33
Nodes (5): current, getByClerkId, getById, store, updateProfile

### Community 30 - "CLAUDE.md"
Cohesion: 0.33
Nodes (6): Convex helpers: audit.ts, permissions.ts, stock.ts, Monorepo Structure: Turborepo + npm workspaces, Route Map (22 routes), Tech Stack: Next.js 16, Convex, Clerk, Tailwind, shadcn v4, Ware-House Inventory & Sales Management SaaS, 3 new routes: sales/[saleId]/return, returns, returns/[returnId]

### Community 31 - "superpowers/specs"
Cohesion: 0.33
Nodes (6): Analytics Page Design Spec, Analytics Architecture: server page + client AnalyticsView with filter state + useQuery, Analytics Components: analytics-view, kpi-card/grid, range-filter, product-filter, insights-section, tables, export-csv-button, charts/*, Analytics Convex API: 9 queries (kpis, dailyRevenue, weeklyRevenue, monthlyRevenue, topProducts, productShare, quantitySoldTrend, ordersByDayOfWeek, insights, dailySummary), Analytics Goal: professional real-time analytics for store owners (KPIs, charts, insights, tables), Rationale: filter state in component state, URL sync deferred

### Community 35 - "web/convex"
Cohesion: 0.4
Nodes (4): list, markAllAsRead, markAsRead, unreadCount

### Community 37 - "web/convex"
Cohesion: 0.5
Nodes (3): create, getByPhone, list

### Community 39 - "web/convex"
Cohesion: 0.5
Nodes (3): listByStore, remove, updateRole

### Community 40 - "convex/_helpers"
Cohesion: 0.83
Nodes (3): assertStoreMember(), assertStorePermission(), getStoreMember()

## Knowledge Gaps
- **188 isolated node(s):** `Tech Stack: Next.js 16, Convex, Clerk, Tailwind, shadcn v4`, `Monorepo Structure: Turborepo + npm workspaces`, `Convex helpers: audit.ts, permissions.ts, stock.ts`, `Plan Task 2: Convex customers.ts functions`, `Plan Task 3: Server actions (customers, sales, returns)` (+183 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **25 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `friendlyMessage()` connect `Community 6` to `Community 32`, `Community 3`, `Community 7`, `Community 10`, `Community 11`, `Community 46`, `Community 23`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `requireCurrentUserId()` connect `Community 3` to `Community 36`, `Community 6`, `Community 7`, `Community 10`, `Community 11`, `Community 23`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Why does `Ware-House Inventory & Sales Management SaaS` connect `Community 30` to `Community 9`, `Community 12`, `Community 18`, `Community 19`, `Community 31`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 19 inferred relationships involving `requireCurrentUserId()` (e.g. with `createProduct()` and `updateProduct()`) actually correct?**
  _`requireCurrentUserId()` has 19 INFERRED edges - model-reasoned connections that need verification._
- **Are the 2 inferred relationships involving `Customer-Linked Sales & Returns Design Spec` (e.g. with `Plan Task 10: Return form page` and `Analytics Page Design Spec`) actually correct?**
  _`Customer-Linked Sales & Returns Design Spec` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Tech Stack: Next.js 16, Convex, Clerk, Tailwind, shadcn v4`, `Monorepo Structure: Turborepo + npm workspaces`, `Convex helpers: audit.ts, permissions.ts, stock.ts` to the rest of the system?**
  _188 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._