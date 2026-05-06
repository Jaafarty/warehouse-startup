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
  if (!product) throw new Error("Product not found");

  const quantityBefore = product.quantity;
  const quantityAfter = quantityBefore + params.quantityChange;

  if (quantityAfter < 0) {
    throw new Error(
      `Insufficient stock. Available: ${quantityBefore}, Requested: ${Math.abs(params.quantityChange)}`
    );
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

  // Check low stock threshold and create notifications
  if (
    quantityAfter <= product.lowStockThreshold &&
    quantityBefore > product.lowStockThreshold
  ) {
    const admins = await db
      .query("storeMembers")
      .withIndex("by_store", (q) => q.eq("storeId", params.storeId))
      .collect();

    for (const admin of admins.filter((m) => m.role === "admin")) {
      await db.insert("notifications", {
        userId: admin.userId,
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
