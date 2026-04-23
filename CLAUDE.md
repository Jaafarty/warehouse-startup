# Ware-House — Inventory & Sales Management SaaS

## Project Overview

A modern, cloud-based inventory and sales management SaaS for small/medium businesses. Enables stock tracking, sales processing, role-based access, and real-time business insights.

## Tech Stack

- **Monorepo**: Turborepo + npm workspaces
- **Frontend**: Next.js 16.2.3 (App Router), shadcn/ui v4 (@base-ui/react), Tailwind CSS v4
- **Backend**: Convex (database, real-time subscriptions, backend logic)
- **Auth**: Clerk (`@clerk/nextjs` ^7.2.3) — hosted sign-in/up pages, JWT issuer wired into Convex via `auth.config.ts`. Convex `users` table keyed by `clerkId` (upserted on first authenticated request).
- **Email**: Resend (via Convex `internalAction` in `convex/email.ts`) — used for store invitations
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
│   │   │       ├── sales/          # Sales list, new sale, sale detail with returns
│   │   │       ├── members/        # Full CRUD with confirmation dialogs
│   │   │       └── settings/       # Store settings
│   │   │   ├── notifications/      # Notifications page
│   │   │   ├── settings/           # User settings (profile + password)
│   │   │   ├── error.tsx           # Error boundary
│   │   │   └── loading.tsx         # Loading skeleton
│   │   ├── auth/sign-in/           # Clerk <SignIn /> catch-all route
│   │   ├── auth/sign-up/           # Clerk <SignUp /> catch-all route
│   │   ├── invite/[token]/         # Accept/decline invitation
│   │   └── actions/                # Server actions (auth.ts, stores.ts, inventory.ts, sales.ts)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui v4 components (+ chart.tsx for recharts)
│   │   └── layout/                 # sidebar.tsx, topbar.tsx (with notification badge)
│   ├── convex/                     # Convex schema + functions
│   │   ├── schema.ts              # Full schema (11 tables) — users keyed by clerkId
│   │   ├── auth.config.ts         # Clerk JWT issuer config (CLERK_JWT_ISSUER_DOMAIN)
│   │   ├── users.ts               # users.store (upsert by clerkId), current, getById, updateProfile
│   │   ├── stores.ts              # Store CRUD
│   │   ├── members.ts             # Member management
│   │   ├── invitations.ts         # Invite system (schedules email.sendInviteEmail)
│   │   ├── email.ts               # internalAction: Resend transactional email (invites)
│   │   ├── products.ts            # Product CRUD (create, list, get, update, archive, restore)
│   │   ├── categories.ts          # Category CRUD
│   │   ├── stockMovements.ts      # Stock movement queries + manual adjust
│   │   ├── sales.ts               # Sales (create with stock decrement, returnItems)
│   │   ├── notifications.ts       # Notifications (list, unreadCount, markAsRead, markAllAsRead)
│   │   ├── analytics.ts           # Analytics (overview, topProducts, salesTrend)
│   │   ├── _helpers/              # audit.ts, permissions.ts, stock.ts
│   │   └── _generated/            # Stub files (replaced by npx convex dev)
│   ├── lib/
│   │   ├── auth.ts                # getCurrentUserId / requireCurrentUserId (server-only, Clerk → Convex users._id)
│   │   ├── use-current-user.ts    # useCurrentUser() client hook (useConvexAuth + api.users.current)
│   │   ├── convex.tsx             # ConvexProviderWithClerk wrapper
│   │   └── utils.ts
│   └── proxy.ts                   # Clerk middleware for route protection (Next.js 16 "proxy" filename)
├── packages/shared/src/           # @ware-house/shared
│   ├── types/                     # auth, store, product, sale
│   ├── validation/                # Zod schemas
│   ├── constants/                 # roles, permissions
│   └── utils/                     # formatCurrency, formatDate
├── package.json, turbo.json, tsconfig.base.json
└── .env.local.example
```

## Implementation Progress

### Phase 0: Monorepo Setup & Tooling — COMPLETE
### Phase 1: Authentication — COMPLETE (migrated to Clerk)
- **Clerk** (`@clerk/nextjs`) hosts sign-in/sign-up UI at `/auth/sign-in` and `/auth/sign-up` (catch-all routes using `<SignIn />` / `<SignUp />`)
- `convex/auth.config.ts` registers the Clerk JWT issuer (`CLERK_JWT_ISSUER_DOMAIN`) so Convex validates Clerk sessions
- `users` table keyed by `clerkId` (indexed `by_clerkId`); `lib/auth.ts` `getCurrentUserId()` upserts the Convex user row from Clerk identity on each server-side call
- `proxy.ts` uses `clerkMiddleware` + `createRouteMatcher` — protects everything except `/`, `/auth/sign-in(.*)`, `/auth/sign-up(.*)`, `/invite/(.*)`, `/api/webhooks/(.*)`
- Client tree wrapped by `ConvexProviderWithClerk` (in `lib/convex.tsx`)
- No password storage, no custom verification flow, no `/api/auth/[...nextauth]` route — all handled by Clerk

### Phase 2: Store Management & Membership — COMPLETE
- Convex functions: stores (create, list, get, update), members (list, updateRole, remove), invitations (create, accept, decline, list)
- Permission helpers: `_helpers/permissions.ts` (assertStorePermission, assertStoreMember)
- Audit log helper: `_helpers/audit.ts`
- Dashboard with store selector/creator
- Store layout with sidebar navigation
- Members page with invite, role management, remove
- Store settings page
- Invitation acceptance page (/invite/[token])
- Build verified: 14 routes compile successfully

### Phase 3: Inventory Management — COMPLETE
- Convex functions: `products.ts` (create, list, get, update, archive, restore), `categories.ts` (list, create, update, remove), `stockMovements.ts` (listByProduct, listByStore, manualAdjust)
- Stock movement helper: `_helpers/stock.ts` — `adjustStock()` enforces all stock changes go through one path (records movement, updates quantity, checks low stock threshold, creates admin notifications)
- Server actions: `actions/inventory.ts` (createProduct, updateProduct, archiveProduct, restoreProduct, adjustProductStock, createCategory)
- Product list page with search, category filter, archive toggle, inline status badges (Low Stock / In Stock / Archived)
- New product form with basic info, identification (SKU/barcode), pricing, and initial stock
- Product detail/edit page with inline stock adjustment dialog (add/remove with note)
- Stock history page showing full movement log with type icons, quantity changes, before/after, performer name
- Build verified: 19 routes compile successfully

### Phase 4: Sales Management — COMPLETE
- Convex functions: `sales.ts` (list, get, create with atomic multi-item stock decrement, returnItems with partial/full return tracking)
- Sale creation: generates sale number (S-YYYYMMDD-XXXX), validates stock availability for all items before committing, uses `adjustStock()` for each line item
- Returns: per-item return quantity tracking on `saleItems.returnedQuantity`, auto-updates sale status to `partially_returned` or `returned`
- Server actions: `actions/sales.ts` (createSale, returnSaleItems)
- Sales list page with status filter (completed / partially returned / returned)
- New sale page with product selector, cart with quantity editing, running total
- Sale detail page with summary cards, line items table, and return dialog
- Build verified: 19 routes compile successfully

### Phase 5: Notifications & Alerts — COMPLETE
- Convex functions: `notifications.ts` (list, unreadCount, markAsRead, markAllAsRead)
- Topbar updated with real-time unread notification count badge
- Low stock notifications created automatically by `adjustStock()` helper
- Notifications page with mark-as-read (individual + bulk), type-specific icons

### Phase 6: Analytics Dashboard — COMPLETE
- Convex functions: `analytics.ts` (overview with 30d revenue/sales/products/stock alerts, topProducts by revenue, salesTrend with daily bucketing)
- Store dashboard page with 4 summary cards (revenue, sales, products, stock alerts)
- Sales trend bar chart (14 days) using shadcn/ui chart component + recharts
- Top products table ranked by revenue

### Phase 7: Polish & Hardening — COMPLETE
- User settings page (`/settings`) with profile (display name) update — email and password are managed by Clerk's hosted user profile
- Error boundary (`error.tsx`) for dashboard route group
- Loading skeleton (`loading.tsx`) for dashboard route group
- Confirmation dialog (AlertDialog) on member removal
- Server action: `updateProfile()` in `actions/auth.ts` (calls `api.users.updateProfile`)
- Build verified: 21 routes compile successfully

### Phase 8: Clerk migration + Resend invite email — COMPLETE
- Removed: `auth.ts` (NextAuth config), `lib/auth-utils.ts`, `/api/auth/[...nextauth]/route.ts`, `/auth/login`, `/auth/signup`, `/auth/verify`, `/auth/error`
- Added: `convex/auth.config.ts`, `convex/email.ts` (Resend `internalAction` scheduled from `invitations.create`), `lib/auth.ts`, `lib/use-current-user.ts`, `/auth/sign-in`, `/auth/sign-up`
- Schema change: `users.clerkId` + `by_clerkId` index (no more local `passwordHash`/`emailVerified` fields for auth)
- Clerk sandbox note for Resend: free tier restricts delivery to the account owner until a domain is verified — `email.ts` handles 403 `validation_error` as a soft failure so the invite row is still created and admins can copy the link from the UI

## Critical Notes for Next Session

### Next.js 16 Breaking Changes
- **middleware.ts is DEPRECATED** — renamed to `proxy.ts`, function export is `proxy` not `middleware`
- **shadcn/ui v4 uses @base-ui/react** — NO `asChild` prop. Triggers are native buttons. Use `className` directly on triggers or `render` prop for custom elements. Do NOT use Radix patterns.
- **shadcn/ui v4 Select `onValueChange` can pass `null`** — wrap with `(v) => setter(v ?? "default")` instead of passing setter directly
- **useSearchParams()** must be wrapped in `<Suspense>` boundaries
- Check `node_modules/next/dist/docs/` for current API docs before writing Next.js code
- `apps/web/AGENTS.md` warns about breaking changes

### Convex Architecture
- `convex/` directory lives inside `apps/web/` (consolidated, no separate apps/backend)
- `convex/_generated/` has **stub files** that allow TypeScript to compile without running `npx convex dev`
- The `convex/` directory is excluded from Next.js tsconfig (`"exclude": ["node_modules", "convex"]`)
- Convex functions use `any` type casts for query index callbacks (e.g., `(q: any) =>`) because stubs don't provide full types
- **User must run `npx convex dev`** in apps/web to set up their Convex project and generate real types

### Auth Pattern (Clerk + Convex)
- **Server actions**: call `requireCurrentUserId()` from `@/lib/auth` — resolves the Clerk identity, upserts the Convex `users` row via `api.users.store`, and returns the `users._id` to pass into Convex mutations. `getCurrentUserId()` is the nullable variant.
- **Client components**: use `useCurrentUser()` from `@/lib/use-current-user` (returns `{ user, userId, isLoading, isAuthenticated }`) or `useQuery(api.users.current)` directly. Auth state comes from `useConvexAuth()` (via `ConvexProviderWithClerk`).
- **Convex functions**: authenticated functions read `ctx.auth.getUserIdentity()` and match against `users.clerkId` (see `users.current`).
- **Required env vars** (`apps/web/.env.local`):
  - `NEXT_PUBLIC_CONVEX_URL` — Convex deployment URL
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — Clerk keys
  - `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/auth/sign-in`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/auth/sign-up`
- **Required Convex deployment env vars** (`npx convex env set ...`):
  - `CLERK_JWT_ISSUER_DOMAIN` — the Clerk JWT issuer (matches the Clerk instance)
  - `RESEND_API_KEY`, `RESEND_FROM`, `SITE_URL` — for invite emails (soft-skipped with a warn log if unset)

### Stock Movement Invariant
- **ALL stock changes MUST go through `adjustStock()` helper** in `convex/_helpers/stock.ts` — no direct `db.patch(productId, { quantity })` allowed
- `adjustStock()` records a `stockMovements` entry, updates product quantity, and auto-creates low-stock notifications for admins when threshold is crossed

### Shared Package
- `packages/shared/src/index.ts` barrel exports from: `types/`, `validation/`, `constants/`, `utils/`
- `utils/index.ts` exports `formatCurrency()` and `formatDate()` — used across inventory and sales UI

## Full Implementation Plan

Detailed plan at `.claude/plans/bubbly-churning-zebra.md`

## Commands

- `npm run dev` — Start all dev servers (turbo)
- From `apps/web`: `npx next dev` — Start Next.js only
- From `apps/web`: `npx convex dev` — Start Convex dev server (requires account)
- From `apps/web`: `npx next build` — Verify build
- `npx shadcn@latest add <component>` — Add shadcn components (run from apps/web)

## Current Route Map (21 routes, build verified)

```
/ (static)                                    — Landing page
/auth/sign-in/[[...sign-in]]                  — Clerk hosted sign-in
/auth/sign-up/[[...sign-up]]                  — Clerk hosted sign-up
/dashboard                                    — Store selector/creator
/invite/[token]                               — Accept/decline invitation
/notifications                                — User notifications (real-time)
/settings                                     — User settings (profile + password)
/store/[storeId]                              — Store analytics dashboard
/store/[storeId]/inventory                    — Product list with search/filter
/store/[storeId]/inventory/new                — Create product form
/store/[storeId]/inventory/[productId]        — Product detail/edit + stock adjust
/store/[storeId]/inventory/[productId]/history — Stock movement log
/store/[storeId]/sales                        — Sales list with status filter
/store/[storeId]/sales/new                    — New sale (product selector + cart)
/store/[storeId]/sales/[saleId]               — Sale detail + return processing
/store/[storeId]/members                      — Member management + confirmation dialogs
/store/[storeId]/settings                     — Store settings
```

> Note: route count above reflects pre-Clerk snapshot. Re-run `npx next build` after the Clerk migration to confirm the current total — the `/api/auth/[...nextauth]` and the four flat `/auth/*` pages have been replaced by the two Clerk catch-all routes.

## No git commits have been made yet.
