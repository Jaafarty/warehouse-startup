import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ============ USERS (synced from Clerk) ============
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // ============ STORES & MEMBERSHIP ============
  stores: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    isActive: v.boolean(),
    // Optional cashier-shifts feature. Undefined === disabled.
    shiftsEnabled: v.optional(v.boolean()),
    createdAt: v.float64(),
  }).index("by_owner", ["ownerId"]),

  storeMembers: defineTable({
    storeId: v.id("stores"),
    userId: v.id("users"),
    role: v.union(
      v.literal("owner"),
      v.literal("admin"),
      v.literal("employee"),
      v.literal("editor"), // legacy — narrow once migrateRolesV2 has run
      v.literal("viewer"),
      v.literal("custom")
    ),
    customRoleId: v.optional(v.id("storeRoles")),
    // permissions kept optional — old rows still valid, new rows omit it
    permissions: v.optional(v.object({
      inventory: v.union(v.literal("none"), v.literal("view"), v.literal("edit"), v.literal("full")),
      sales: v.union(v.literal("none"), v.literal("view"), v.literal("edit"), v.literal("full")),
      analytics: v.union(v.literal("none"), v.literal("view")),
      members: v.union(v.literal("none"), v.literal("view"), v.literal("manage")),
    })),
    joinedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_user", ["userId"])
    .index("by_store_and_user", ["storeId", "userId"]),

  storeInvitations: defineTable({
    storeId: v.id("stores"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("employee"),
      v.literal("editor"), // legacy — narrow once migrateRolesV2 has run
      v.literal("viewer"),
      v.literal("custom")
    ),
    customRoleId: v.optional(v.id("storeRoles")),
    invitedBy: v.id("users"),
    token: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("expired")
    ),
    expiresAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_email", ["email"])
    .index("by_token", ["token"])
    .index("by_store_and_email", ["storeId", "email"]),

  storeRoles: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    permissions: v.any(), // StorePermissions tree — typed in application layer
    createdBy: v.id("users"),
    createdAt: v.float64(),
  }).index("by_store", ["storeId"]),

  // ============ CUSTOMERS ============
  customers: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    phone: v.string(),
    createdBy: v.id("users"),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_phone", ["storeId", "phone"])
    .index("by_store_and_name", ["storeId", "name"]),

  // ============ PRODUCTS & CATEGORIES ============
  categories: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_name", ["storeId", "name"]),

  products: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    description: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    barcode: v.optional(v.string()),
    sku: v.optional(v.string()),
    quantity: v.float64(),
    // Legacy single-currency price fields. Kept optional during the
    // dual-currency transition so existing rows remain valid until the
    // backfill mutation populates the new *USD/*LBP fields. Read paths
    // fall back to these when the new fields are missing.
    costPrice: v.optional(v.float64()),
    sellingPrice: v.optional(v.float64()),
    // Dual-currency prices. At least one of sellingPriceUSD / sellingPriceLBP
    // must be set when creating/updating a product (validated in the mutation).
    costPriceUSD: v.optional(v.float64()),
    costPriceLBP: v.optional(v.float64()),
    sellingPriceUSD: v.optional(v.float64()),
    sellingPriceLBP: v.optional(v.float64()),
    lowStockThreshold: v.float64(),
    isArchived: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_category", ["storeId", "categoryId"])
    .index("by_store_and_barcode", ["storeId", "barcode"])
    .index("by_store_and_archived", ["storeId", "isArchived"]),

  // ============ EXCHANGE RATES (USD <-> LBP, append-only history) ============
  exchangeRates: defineTable({
    storeId: v.id("stores"),
    rate: v.float64(), // 1 USD = `rate` LBP
    effectiveFrom: v.float64(), // ms timestamp the rate took effect
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_effective", ["storeId", "effectiveFrom"]),

  // ============ STOCK MOVEMENTS (AUDIT TRAIL) ============
  stockMovements: defineTable({
    storeId: v.id("stores"),
    productId: v.id("products"),
    type: v.union(
      v.literal("sale"),
      v.literal("return"),
      v.literal("manual_add"),
      v.literal("manual_remove"),
      v.literal("adjustment"),
      v.literal("initial")
    ),
    quantityChange: v.float64(),
    quantityBefore: v.float64(),
    quantityAfter: v.float64(),
    referenceId: v.optional(v.string()),
    referenceType: v.optional(
      v.union(
        v.literal("sale"),
        v.literal("sale_return"),
        v.literal("manual")
      )
    ),
    note: v.optional(v.string()),
    performedBy: v.id("users"),
    timestamp: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_product", ["productId"])
    .index("by_store_and_product", ["storeId", "productId"])
    .index("by_store_and_type", ["storeId", "type"])
    .index("by_store_and_timestamp", ["storeId", "timestamp"]),

  // ============ SALES ============
  sales: defineTable({
    storeId: v.id("stores"),
    saleNumber: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("returned"),
      v.literal("partially_returned")
    ),
    // totalAmount: USD-equivalent total. Kept as the canonical revenue figure
    // for backwards compatibility with analytics that reference it directly.
    totalAmount: v.float64(),
    itemCount: v.float64(),
    // Snapshot exchange rate at sale time (1 USD = `exchangeRate` LBP).
    // Optional only during the dual-currency transition; new sales always set it.
    exchangeRate: v.optional(v.float64()),
    totalUSD: v.optional(v.float64()),
    totalLBP: v.optional(v.float64()),
    paidUSD: v.optional(v.float64()),
    paidLBP: v.optional(v.float64()),
    note: v.optional(v.string()),
    customerId: v.optional(v.id("customers")),
    // Set when the store has shifts enabled and a sale is recorded against
    // the cashier's active shift. Optional so legacy rows remain valid.
    shiftId: v.optional(v.id("shifts")),
    createdBy: v.id("users"),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_store_and_date", ["storeId", "createdAt"])
    .index("by_sale_number", ["storeId", "saleNumber"])
    .index("by_store_and_customer", ["storeId", "customerId"])
    .index("by_shift", ["shiftId"]),

  saleItems: defineTable({
    saleId: v.id("sales"),
    storeId: v.id("stores"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.float64(),
    // unitPrice / totalPrice are stored in the item's `currency`.
    unitPrice: v.float64(),
    totalPrice: v.float64(),
    // Currency the unitPrice was charged in. Optional during transition;
    // legacy items default to USD on read.
    currency: v.optional(v.union(v.literal("USD"), v.literal("LBP"))),
    // Canonical USD-normalized unit price (using sale.exchangeRate). Used by
    // analytics so revenue is always comparable across currencies.
    unitPriceUSD: v.optional(v.float64()),
    returnedQuantity: v.float64(),
  })
    .index("by_sale", ["saleId"])
    .index("by_store_and_product", ["storeId", "productId"]),

  // ============ SALE RETURNS ============
  saleReturns: defineTable({
    storeId: v.id("stores"),
    saleId: v.id("sales"),
    returnNumber: v.string(),
    reason: v.union(
      v.literal("defective"),
      v.literal("wrong_item"),
      v.literal("damaged_in_transit"),
      v.literal("customer_changed_mind"),
      v.literal("other")
    ),
    note: v.optional(v.string()),
    // totalRefund: USD-equivalent refund (canonical analytics figure).
    totalRefund: v.float64(),
    itemCount: v.float64(),
    // Snapshot of the originating sale's rate (NEVER current rate) so that
    // refunds always map to the rate the customer originally paid at.
    exchangeRate: v.optional(v.float64()),
    refundedUSD: v.optional(v.float64()),
    refundedLBP: v.optional(v.float64()),
    shiftId: v.optional(v.id("shifts")),
    createdBy: v.id("users"),
    createdAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_date", ["storeId", "createdAt"])
    .index("by_sale", ["saleId"])
    .index("by_return_number", ["storeId", "returnNumber"])
    .index("by_shift", ["shiftId"]),

  saleReturnItems: defineTable({
    returnId: v.id("saleReturns"),
    saleItemId: v.id("saleItems"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.float64(),
    // unitPrice / totalRefund are in the item's `currency`.
    unitPrice: v.float64(),
    totalRefund: v.float64(),
    currency: v.optional(v.union(v.literal("USD"), v.literal("LBP"))),
    unitPriceUSD: v.optional(v.float64()),
  })
    .index("by_return", ["returnId"])
    .index("by_sale_item", ["saleItemId"]),

  // ============ NOTIFICATIONS ============
  notifications: defineTable({
    userId: v.id("users"),
    storeId: v.optional(v.id("stores")),
    type: v.union(
      v.literal("store_invitation"),
      v.literal("low_stock_alert"),
      v.literal("sale_completed"),
      v.literal("member_joined")
    ),
    title: v.string(),
    message: v.string(),
    isRead: v.boolean(),
    metadata: v.optional(v.any()),
    createdAt: v.float64(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_read", ["userId", "isRead"])
    .index("by_user_and_store", ["userId", "storeId"]),

  // ============ REGISTERS (physical cash registers / tills) ============
  // Optional: a store with zero registers uses a single implicit drawer
  // (legacy behaviour). Once defined, a shift is opened on a specific register.
  registers: defineTable({
    storeId: v.id("stores"),
    name: v.string(),
    // Archived registers (isActive=false) keep history but can't be selected.
    isActive: v.boolean(),
    createdBy: v.id("users"),
    createdAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_active", ["storeId", "isActive"])
    .index("by_store_and_name", ["storeId", "name"]),

  // ============ CASHIER SHIFTS ============
  shifts: defineTable({
    storeId: v.id("stores"),
    openedBy: v.id("users"),
    closedBy: v.optional(v.id("users")),
    status: v.union(v.literal("open"), v.literal("closed")),

    // Which register this shift was opened on. Absent on legacy shifts and on
    // stores that have no registers defined (implicit single drawer).
    registerId: v.optional(v.id("registers")),

    // Opening drawer counts entered by the cashier.
    openingUSD: v.float64(),
    openingLBP: v.float64(),
    // Snapshot rate at open — used for any USD-equivalent display.
    openingExchangeRate: v.float64(),
    // True when the opening figures were seeded from the last closed shift
    // on the same register's countedUSD/LBP.
    carriedOver: v.boolean(),

    // Closing — populated when status flips to "closed".
    countedUSD: v.optional(v.float64()),
    countedLBP: v.optional(v.float64()),
    expectedClosingUSD: v.optional(v.float64()),
    expectedClosingLBP: v.optional(v.float64()),
    discrepancyUSD: v.optional(v.float64()),
    discrepancyLBP: v.optional(v.float64()),
    discrepancyNote: v.optional(v.string()),

    openedAt: v.float64(),
    closedAt: v.optional(v.float64()),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_store_and_user", ["storeId", "openedBy"])
    .index("by_store_user_status", ["storeId", "openedBy", "status"])
    .index("by_register_and_status", ["registerId", "status"])
    .index("by_store_and_date", ["storeId", "openedAt"]),

  shiftCashEvents: defineTable({
    storeId: v.id("stores"),
    shiftId: v.optional(v.id("shifts")),
    // Register this event belongs to (copied from the originating shift).
    // Absent for legacy events and events on the implicit single drawer.
    registerId: v.optional(v.id("registers")),
    type: v.union(
      v.literal("sale"),
      v.literal("return"),
      v.literal("change_out"),
      v.literal("manual_in"),
      v.literal("manual_out"),
      v.literal("reopen_adjustment")
    ),
    // Signed deltas. Positive = into drawer, negative = out.
    amountUSD: v.float64(),
    amountLBP: v.float64(),
    reason: v.optional(v.string()),
    referenceType: v.optional(
      v.union(v.literal("sale"), v.literal("sale_return"))
    ),
    referenceId: v.optional(v.string()),
    performedBy: v.id("users"),
    createdAt: v.float64(),
  })
    .index("by_shift", ["shiftId"])
    .index("by_shift_and_type", ["shiftId", "type"])
    .index("by_register_and_date", ["registerId", "createdAt"])
    .index("by_store_and_date", ["storeId", "createdAt"]),

  // ============ AUDIT LOG ============
  auditLogs: defineTable({
    storeId: v.id("stores"),
    userId: v.id("users"),
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    details: v.optional(v.any()),
    timestamp: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_entity", ["storeId", "entityType"])
    .index("by_store_and_timestamp", ["storeId", "timestamp"])
    .index("by_store_and_user", ["storeId", "userId"]),
});
