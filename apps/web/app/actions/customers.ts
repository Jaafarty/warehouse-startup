"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createCustomer(
  storeId: string,
  name: string,
  phone: string
) {
  const userId = await requireCurrentUserId();

  if (!name.trim()) return { success: false, error: "Name is required" };
  if (!phone.trim()) return { success: false, error: "Phone is required" };

  try {
    const result = await convex.mutation(api.customers.create, {
      storeId: storeId as any,
      userId,
      name: name.trim(),
      phone: phone.trim(),
    });
    return { success: true, customerId: result.customerId };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create customer",
    };
  }
}
