import { DatabaseReader } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Returns the most recent exchange rate row for a store, or null if none has
 * ever been set. New sales must snapshot the rate at creation time so changing
 * the rate later never alters historical totals.
 */
export async function getCurrentRateRow(
  db: DatabaseReader,
  storeId: Id<"stores">
) {
  return db
    .query("exchangeRates")
    .withIndex("by_store_and_effective", (q) => q.eq("storeId", storeId))
    .order("desc")
    .first();
}

export async function getCurrentRate(
  db: DatabaseReader,
  storeId: Id<"stores">
): Promise<number> {
  const row = await getCurrentRateRow(db, storeId);
  // Default to 1 if a store has no rate yet (single-currency mode). Mutations
  // that depend on a real rate (split-payment sales) should validate above this.
  return row?.rate ?? 1;
}

export type Currency = "USD" | "LBP";

export function convertToUSD(
  amount: number,
  currency: Currency,
  rate: number
): number {
  if (currency === "USD") return amount;
  if (rate <= 0) return 0;
  return amount / rate;
}

export function convertFromUSD(
  amountUSD: number,
  currency: Currency,
  rate: number
): number {
  if (currency === "USD") return amountUSD;
  return amountUSD * rate;
}
