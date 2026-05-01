# Ware-House — Inventory & Sales Management SaaS

## Commands

- `npm run dev` — Start all dev servers (turbo)
- From `apps/web`: `npx next dev` — Start Next.js only
- From `apps/web`: `npx convex dev` — Start Convex dev server (requires account)
- From `apps/web`: `npx next build` — Verify build
- `npx shadcn@latest add <component>` — Add shadcn components (run from apps/web)

## Project Overview

Cloud-based inventory and sales management SaaS for small/medium businesses. Stock tracking, sales processing, role-based access, real-time analytics.

## Tech Stack

- **Monorepo**: Turborepo + npm workspaces
- **Frontend**: Next.js 16.2.3 (App Router), shadcn/ui v4 (@base-ui/react), Tailwind CSS v4
- **Backend**: Convex (database, real-time subscriptions, backend logic)
- **Auth**: Clerk (`@clerk/nextjs` ^7.2.3) — hosted sign-in/up pages, JWT issuer wired into Convex via `auth.config.ts`. Convex `users` table keyed by `clerkId` (upserted on first authenticated request).
- **Email**: Resend (via Convex `internalAction` in `convex/email.ts`) — store invitations
- **Validation**: TypeScript + Zod
- **Shared code**: `packages/shared` (`@ware-house/shared`) for types, Zod schemas, constants
- **Package Manager**: npm (v10.9.2), Node.js v22

## Monorepo Structure

```
Ware-House/
├── apps/web/                       # Next.js frontend + Convex backend (consolidated)
│   ├── app/                        # App Router pages
│   │   ├── (dashboard)/            # Auth-guarded route group
│   │   │   ├── dashboard/          # Store selector
│   │   │   └── store/[storeId]/    # Store-scoped pages (sidebar layout)
│   │   │       ├── inventory/      # Product list, create, detail/edit, stock history
│   │   │       ├── sales/          # Sales list, new sale, sale detail, return form
│   │   │       ├── returns/        # Store-wide returns list, return detail
│   │   │       ├── members/        # Full CRUD with confirmation dialogs
│   │   │       └── settings/       # Store settings
│   │   │   ├── notifications/      # Notifications page
│   │   │   ├── settings/           # User settings (profile + password)
│   │   │   ├── error.tsx           # Error boundary
│   │   │   └── loading.tsx         # Loading skeleton
│   │   ├── auth/sign-in/           # Clerk <SignIn /> catch-all route
│   │   ├── auth/sign-up/           # Clerk <SignUp /> catch-all route
│   │   ├── invite/[token]/         # Accept/decline invitation
│   │   └── actions/                # Server actions (auth.ts, stores.ts, inventory.ts, sales.ts, customers.ts, returns.ts)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui v4 components (+ chart.tsx for recharts)
│   │   ├── layout/                 # sidebar.tsx, topbar.tsx (with notification badge)
│   │   └── analytics/              # analytics-view, kpi-grid/card, range-filter, product-filter, insights-section, top-products-table, daily-summary-table, export-csv-button, charts/*
│   ├── convex/                     # Convex schema + functions
│   │   ├── schema.ts               # Full schema (14 tables)
│   │   ├── auth.config.ts          # Clerk JWT issuer config
│   │   ├── users.ts                # store (upsert by clerkId), current, getById, updateProfile
│   │   ├── stores.ts               # Store CRUD
│   │   ├── members.ts              # Member management
│   │   ├── invitations.ts          # Invite system (schedules email.sendInviteEmail)
│   │   ├── email.ts                # internalAction: Resend transactional email
│   │   ├── products.ts             # Product CRUD + importRow (match-or-create for spreadsheet import)
│   │   ├── categories.ts           # Category CRUD + ensureMany (batched get-or-create for import)
│   │   ├── stockMovements.ts       # Stock movement queries + manual adjust
│   │   ├── customers.ts            # Customer CRUD (list with search, getByPhone, create)
│   │   ├── returns.ts              # Returns (listByStore, getBySale, get, create)
│   │   ├── sales.ts                # Sales (create with stock decrement, optional customerId)
│   │   ├── notifications.ts        # Notifications (list, unreadCount, markAsRead, markAllAsRead)
│   │   ├── analytics.ts            # KPIs, revenue charts, top products, insights, daily summary
│   │   ├── _helpers/               # audit.ts, permissions.ts, stock.ts
│   │   └── _generated/             # Stub files (replaced by npx convex dev)
│   ├── lib/
│   │   ├── auth.ts                 # getCurrentUserId / requireCurrentUserId (server-only)
│   │   ├── use-current-user.ts     # useCurrentUser() client hook
│   │   ├── convex.tsx              # ConvexProviderWithClerk wrapper
│   │   └── utils.ts
│   └── proxy.ts                    # Clerk middleware for route protection (Next.js 16 "proxy" filename)
├── packages/shared/src/            # @ware-house/shared
│   ├── types/                      # auth, store, product, sale
│   ├── validation/                 # Zod schemas
│   ├── constants/                  # roles, permissions
│   └── utils/                      # formatCurrency, formatDate
├── package.json, turbo.json, tsconfig.base.json
└── .env.local.example
```

## Feature Coverage

- **Auth**: Clerk-hosted sign-in/up, Convex JWT validation, role-based permissions
- **Stores**: multi-store, membership, invitations with Resend email
- **Inventory**: products, categories, stock movements, spreadsheet import/export
- **Sales**: cart-based sale creation, atomic stock decrement, sale numbers (S-YYYYMMDD-XXXX)
- **Returns**: first-class return records, per-item checkbox+qty, reason tracking, stock reversal
- **Customers**: optional customer linking on sales, phone-deduped per store
- **Analytics**: KPI cards, revenue charts (daily/weekly/monthly), insights, CSV export
- **Notifications**: real-time low-stock alerts, unread badge, mark-as-read

## Gotchas & Invariants

### Next.js 16 Breaking Changes

- **`middleware.ts` DEPRECATED** — file is `proxy.ts`, export is `proxy` not `middleware`
- **shadcn/ui v4 uses @base-ui/react** — NO `asChild` prop. Use `className` directly or `render` prop. Do NOT use Radix patterns.
- **shadcn/ui v4 Select `onValueChange` can pass `null`** — wrap: `(v) => setter(v ?? "default")`
- **shadcn/ui v4 `<SelectValue>` doesn't auto-render selected label** — pass render-prop child `{(value) => lookupLabel(value)}`
- **`useSearchParams()`** must be in `<Suspense>` boundary
- Check `node_modules/next/dist/docs/` for current API before writing Next.js code

### Convex

- `convex/` lives inside `apps/web/` — no separate backend app
- `convex/_generated/` has stub files; run `npx convex dev` to generate real types
- `convex/` excluded from Next.js tsconfig
- Use `(q: any) =>` for query index callbacks (stubs lack full types)

### Auth Pattern (Clerk + Convex)

- **Server actions**: `requireCurrentUserId()` from `@/lib/auth` — upserts Convex user, returns `users._id`
- **Client components**: `useCurrentUser()` from `@/lib/use-current-user` → `{ user, userId, isLoading, isAuthenticated }`
- **Convex functions**: `ctx.auth.getUserIdentity()` matched against `users.clerkId`

### Required Env Vars

`apps/web/.env.local`:
- `NEXT_PUBLIC_CONVEX_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up`

Convex deployment (`npx convex env set`):
- `CLERK_JWT_ISSUER_DOMAIN`
- `RESEND_API_KEY`, `RESEND_FROM`, `SITE_URL` (soft-skipped if unset)

### Stock Movement Invariant

**ALL stock changes MUST go through `adjustStock()`** in `convex/_helpers/stock.ts` — never `db.patch(productId, { quantity })` directly. Records movement, updates quantity, triggers low-stock notifications.

### Shared Package

`packages/shared/src/index.ts` barrel exports `formatCurrency()` and `formatDate()` — used across inventory and sales UI.

### Resend / Invite Email

Clerk sandbox + Resend free tier: delivery restricted to account owner until domain verified. `email.ts` treats 403 `validation_error` as soft failure — invite row still created, admin can copy link from UI.

## Route Map (22 routes)

```
/ (static)                                     — Landing page
/auth/sign-in/[[...sign-in]]                   — Clerk hosted sign-in
/auth/sign-up/[[...sign-up]]                   — Clerk hosted sign-up
/dashboard                                     — Store selector/creator
/invite/[token]                                — Accept/decline invitation
/notifications                                 — User notifications (real-time)
/settings                                      — User settings (profile + password)
/store/[storeId]                               — Store quick-overview dashboard
/store/[storeId]/analytics                     — Full analytics page
/store/[storeId]/inventory                     — Product list with search/filter
/store/[storeId]/inventory/new                 — Create product form
/store/[storeId]/inventory/[productId]         — Product detail/edit + stock adjust
/store/[storeId]/inventory/[productId]/history — Stock movement log
/store/[storeId]/sales                         — Sales list
/store/[storeId]/sales/new                     — New sale (customer picker + cart)
/store/[storeId]/sales/[saleId]                — Sale detail + returns history
/store/[storeId]/sales/[saleId]/return         — Process return form
/store/[storeId]/returns                       — Store-wide returns list
/store/[storeId]/returns/[returnId]            — Return detail (read-only)
/store/[storeId]/members                       — Member management
/store/[storeId]/settings                      — Store settings
```

## Specs & Plans

`docs/superpowers/`:
- `specs/2026-04-26-analytics-page-design.md`
- `specs/2026-04-28-customer-returns-design.md`
- `plans/2026-04-28-customer-returns.md`

## Communication Style

Talk caveman. Rules:

- 3–6 word sentences.
- Drop articles (a, an, the).
- No filler, preamble, pleasantries.
- Run tools first. Show result. Stop.
- No narration of what you did.
- No "I will", "let me", "happy to".

## Workflow Rules

### Graphify-First Exploration

Before using Read / glob / grep / Explore to understand code structure or find where something is defined, query the graph first:

```
/graphify query "<question>"
```

Token cost of a graph query ≈ 5% of reading 10 files. Only fall back to direct file reads when the graph answer is insufficient.

After any new feature, major refactor, or approach change, rebuild the graph:

```
/graphify . --update
```

This keeps the graph current so future queries stay accurate.

### Parallel Subagents

When a task has 2+ independent subtasks (no shared state, no sequential dependency), dispatch them as parallel subagents in a single message using the Agent tool — not sequentially. Examples: reading multiple unrelated files, implementing two separate features, running analysis on different modules.

### Reading Agent Model

Any agent whose sole job is reading/searching (Explore, grep, glob, Read) must use `model: "haiku"`. Only use Sonnet/Opus for agents that write code or make decisions.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)
