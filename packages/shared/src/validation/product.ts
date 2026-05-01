import { z } from "zod";

export const createProductSchema = z
  .object({
    name: z.string().min(1, "Product name is required"),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    barcode: z.string().optional(),
    sku: z.string().optional(),
    quantity: z.number().min(0, "Quantity cannot be negative"),
    costPriceUSD: z.number().min(0, "Cost price cannot be negative").optional(),
    costPriceLBP: z.number().min(0, "Cost price cannot be negative").optional(),
    sellingPriceUSD: z
      .number()
      .min(0, "Selling price cannot be negative")
      .optional(),
    sellingPriceLBP: z
      .number()
      .min(0, "Selling price cannot be negative")
      .optional(),
    lowStockThreshold: z
      .number()
      .min(0, "Threshold cannot be negative")
      .default(10),
  })
  .refine(
    (d) => d.sellingPriceUSD !== undefined || d.sellingPriceLBP !== undefined,
    {
      message: "At least one selling price (USD or LBP) is required",
      path: ["sellingPriceUSD"],
    }
  );

export const updateProductSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    categoryId: z.string().optional(),
    barcode: z.string().optional(),
    sku: z.string().optional(),
    costPriceUSD: z.number().min(0).optional(),
    costPriceLBP: z.number().min(0).optional(),
    sellingPriceUSD: z.number().min(0).optional(),
    sellingPriceLBP: z.number().min(0).optional(),
    lowStockThreshold: z.number().min(0).optional(),
  });

export const stockAdjustmentSchema = z.object({
  quantityChange: z
    .number()
    .refine((v) => v !== 0, "Quantity change cannot be zero"),
  note: z.string().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type StockAdjustmentInput = z.infer<typeof stockAdjustmentSchema>;
