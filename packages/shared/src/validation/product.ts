import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  barcode: z.string().optional(),
  sku: z.string().optional(),
  quantity: z.number().min(0, "Quantity cannot be negative"),
  costPrice: z.number().min(0, "Cost price cannot be negative"),
  sellingPrice: z.number().min(0, "Selling price cannot be negative"),
  lowStockThreshold: z.number().min(0, "Threshold cannot be negative").default(10),
});

export const updateProductSchema = createProductSchema.partial().omit({
  quantity: true,
});

export const stockAdjustmentSchema = z.object({
  quantityChange: z.number().refine((v) => v !== 0, "Quantity change cannot be zero"),
  note: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
