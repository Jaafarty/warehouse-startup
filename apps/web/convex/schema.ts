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
    createdAt: v.float64(),
  }).index("by_owner", ["ownerId"]),

  storeMembers: defineTable({
    storeId: v.id("stores"),
    userId: v.id("users"),
    role: v.union(
      v.literal("admin"),
      v.literal("editor"),
      v.literal("viewer")
    ),
    permissions: v.object({
      inventory: v.union(
        v.literal("none"),
        v.literal("view"),
        v.literal("edit"),
        v.literal("full")
      ),
      sales: v.union(
        v.literal("none"),
        v.literal("view"),
        v.literal("edit"),
        v.literal("full")
      ),
      analytics: v.union(v.literal("none"), v.literal("view")),
      members: v.union(
        v.literal("none"),
        v.literal("view"),
        v.literal("manage")
      ),
    }),
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
      v.literal("editor"),
      v.literal("viewer")
    ),
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
    costPrice: v.float64(),
    sellingPrice: v.float64(),
    lowStockThreshold: v.float64(),
    isArchived: v.boolean(),
    createdBy: v.id("users"),
    updatedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_category", ["storeId", "categoryId"])
    .index("by_store_and_barcode", ["storeId", "barcode"])
    .index("by_store_and_archived", ["storeId", "isArchived"]),

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
    totalAmount: v.float64(),
    itemCount: v.float64(),
    note: v.optional(v.string()),
    createdBy: v.id("users"),
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_store", ["storeId"])
    .index("by_store_and_status", ["storeId", "status"])
    .index("by_store_and_date", ["storeId", "createdAt"])
    .index("by_sale_number", ["storeId", "saleNumber"]),

  saleItems: defineTable({
    saleId: v.id("sales"),
    storeId: v.id("stores"),
    productId: v.id("products"),
    productName: v.string(),
    quantity: v.float64(),
    unitPrice: v.float64(),
    totalPrice: v.float64(),
    returnedQuantity: v.float64(),
  })
    .index("by_sale", ["saleId"])
    .index("by_store_and_product", ["storeId", "productId"]),

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
