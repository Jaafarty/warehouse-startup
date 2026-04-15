import { z } from "zod";

export const saleItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive("Quantity must be positive"),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  note: z.string().optional(),
});

export const returnItemsSchema = z.object({
  items: z
    .array(
      z.object({
        saleItemId: z.string().min(1),
        quantity: z.number().positive("Return quantity must be positive"),
      })
    )
    .min(1, "At least one item to return is required"),
});

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ReturnItemsInput = z.infer<typeof returnItemsSchema>;
