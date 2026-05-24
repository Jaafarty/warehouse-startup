"use server";

import { ConvexHttpClient } from "convex/browser";
import { redirect } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { requireCurrentUserId } from "@/lib/auth";
import { friendlyMessage } from "@/lib/extract-error";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function parseAmount(value: FormDataEntryValue | null): number {
  if (typeof value !== "string") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export async function setShiftsEnabled(storeId: string, enabled: boolean) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.stores.update, {
      storeId: storeId as Id<"stores">,
      userId,
      shiftsEnabled: enabled,
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: friendlyMessage(error, "Failed to update store"),
    };
  }
}

export async function openShift(storeId: string, formData: FormData) {
  const userId = await requireCurrentUserId();
  const carryOver = formData.get("carryOver") === "on";
  const openingUSD = parseAmount(formData.get("openingUSD"));
  const openingLBP = parseAmount(formData.get("openingLBP"));
  try {
    const result = await convex.mutation(api.shifts.open, {
      storeId: storeId as Id<"stores">,
      userId,
      openingUSD,
      openingLBP,
      carryOver,
    });
    redirect(`/store/${storeId}/shifts/${result.shiftId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return {
      success: false as const,
      error: friendlyMessage(error, "Failed to open shift"),
    };
  }
}

export async function closeShift(
  shiftId: string,
  countedUSD: number,
  countedLBP: number,
  note?: string
) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.shifts.close, {
      shiftId: shiftId as Id<"shifts">,
      userId,
      countedUSD,
      countedLBP,
      note: note?.trim() || undefined,
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: friendlyMessage(error, "Failed to close shift"),
    };
  }
}

export async function reopenShift(shiftId: string, reason: string) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.shifts.reopen, {
      shiftId: shiftId as Id<"shifts">,
      userId,
      reason,
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: friendlyMessage(error, "Failed to reopen shift"),
    };
  }
}

export async function recordCash(
  storeId: string,
  direction: "in" | "out",
  amountUSD: number,
  amountLBP: number,
  reason: string
) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.shifts.recordManualCash, {
      storeId: storeId as Id<"stores">,
      userId,
      direction,
      amountUSD,
      amountLBP,
      reason,
    });
    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: friendlyMessage(error, "Failed to record cash event"),
    };
  }
}
