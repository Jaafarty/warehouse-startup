export interface Product {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  categoryId?: string;
  barcode?: string;
  sku?: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  lowStockThreshold: number;
  isArchived: boolean;
  createdBy: string;
  updatedAt: number;
}

export type StockMovementType =
  | "sale"
  | "return"
  | "manual_add"
  | "manual_remove"
  | "adjustment"
  | "initial";
