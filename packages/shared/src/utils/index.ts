export type Currency = "USD" | "LBP";

export function formatCurrency(
  amount: number,
  currency: Currency = "USD"
): string {
  if (currency === "LBP") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "LBP",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(amount);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}
