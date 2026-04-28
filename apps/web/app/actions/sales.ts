"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createSale(
  storeId: string,
  items: { productId: string; quantity: number }[],
  note?: string,
  customerId?: string
) {
  const userId = await requireCurrentUserId();

  if (items.length === 0) {
    return { success: false, error: "Add at least one item" };
  }

  try {
    const result = await convex.mutation(api.sales.create, {
      storeId: storeId as any,
      userId,
      items: items.map((i) => ({
        productId: i.productId as any,
        quantity: i.quantity,
      })),
      note,
      customerId: customerId ? (customerId as any) : undefined,
    });
    redirect(`/store/${storeId}/sales/${result.saleId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create sale",
    };
  }
}
