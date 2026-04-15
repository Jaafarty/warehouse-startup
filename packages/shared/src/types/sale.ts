export type SaleStatus = "completed" | "returned" | "partially_returned";

export interface SaleItem {
  productId: string;
  quantity: number;
}
