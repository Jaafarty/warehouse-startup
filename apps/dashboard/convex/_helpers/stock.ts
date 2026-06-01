import { ConvexError } from "convex/values";
import { DatabaseWriter } from "../_generated/server";
import { Id } from "../_generated/dataModel";

export async function adjustStock(
  db: DatabaseWriter,
  params: {
    storeId: Id<"stores">;
    productId: Id<"products">;
    type:
      | "sale"
      | "return"
      | "manual_add"
      | "manual_remove"
      | "adjustment"
      | "initial";
    quantityChange: number;
    performedBy: Id<"users">;
    referenceId?: string;
    referenceType?: "sale" | "sale_return" | "manual";
    note?: string;
  }
) {
  const product = await db.get(params.productId);
  if (!product) throw new ConvexError({ code: "NOT_FOUND", message: "Product not found" });

  const quantityBefore = product.quantity;
  const quantityAfter = quantityBefore + params.quantityChange;

  if (quantityAfter < 0) {
    throw new ConvexError({
      code: "INSUFFICIENT_STOCK",
      message: `Insufficient stock. Available: ${quantityBefore}, Requested: ${Math.abs(params.quantityChange)}`,
    });
  }

  // Update product quantity
  await db.patch(params.productId, {
    quantity: quantityAfter,
    updatedAt: Date.now(),
  });

  // Record the movement
  await db.insert("stockMovements", {
    storeId: params.storeId,
    productId: params.productId,
    type: params.type,
    quantityChange: params.quantityChange,
    quantityBefore,
    quantityAfter,
    referenceId: params.referenceId,
    referenceType: params.referenceType,
    note: params.note,
    performedBy: params.performedBy,
    timestamp: Date.now(),
  });

  // Fire low-stock alert whenever a decrease lands at or below threshold.
  if (
    params.quantityChange < 0 &&
    quantityAfter <= product.lowStockThreshold
  ) {
    const recipients = await db
      .query("storeMembers")
      .withIndex("by_store", (q) => q.eq("storeId", params.storeId))
      .collect();

    for (const recipient of recipients.filter(
      (m) => m.role === "owner" || m.role === "admin"
    )) {
      await db.insert("notifications", {
        userId: recipient.userId,
        storeId: params.storeId,
        type: "low_stock_alert",
        title: "Low Stock Alert",
        message: `${product.name} is now at ${quantityAfter} units (threshold: ${product.lowStockThreshold})`,
        isRead: false,
        metadata: {
          productId: params.productId,
          currentQuantity: quantityAfter,
        },
        createdAt: Date.now(),
      });
    }
  }

  return { quantityBefore, quantityAfter };
}
