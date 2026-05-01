"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type Reason =
  | "defective"
  | "wrong_item"
  | "damaged_in_transit"
  | "customer_changed_mind"
  | "other";

export async function createReturn(
  saleId: string,
  items: { saleItemId: string; quantity: number }[],
  reason: Reason,
  note?: string,
  refund?: { refundedUSD: number; refundedLBP: number }
) {
  const userId = await requireCurrentUserId();

  if (items.length === 0) {
    return { success: false, error: "Select at least one item to return" };
  }

  if (reason === "other" && !note?.trim()) {
    return { success: false, error: "Note is required when reason is Other" };
  }

  try {
    const result = await convex.mutation(api.returns.create, {
      saleId: saleId as any,
      userId,
      items: items.map((i) => ({
        saleItemId: i.saleItemId as any,
        quantity: i.quantity,
      })),
      reason,
      note: note?.trim() || undefined,
      refundedUSD: refund?.refundedUSD,
      refundedLBP: refund?.refundedLBP,
    });
    return {
      success: true,
      returnId: result.returnId as string,
      returnNumber: result.returnNumber,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to process return",
    };
  }
}
