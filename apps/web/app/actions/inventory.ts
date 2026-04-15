"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createProduct(storeId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || undefined;
  const categoryId = (formData.get("categoryId") as string) || undefined;
  const barcode = (formData.get("barcode") as string) || undefined;
  const sku = (formData.get("sku") as string) || undefined;
  const quantity = Number(formData.get("quantity") || 0);
  const costPrice = Number(formData.get("costPrice") || 0);
  const sellingPrice = Number(formData.get("sellingPrice") || 0);
  const lowStockThreshold = Number(formData.get("lowStockThreshold") || 5);

  if (!name || name.trim().length < 1) {
    return { success: false, error: "Product name is required" };
  }
  if (sellingPrice <= 0) {
    return { success: false, error: "Selling price must be greater than 0" };
  }

  try {
    const productId = await convex.mutation(api.products.create, {
      storeId: storeId as any,
      userId: session.user.id as any,
      name: name.trim(),
      description: description?.trim(),
      categoryId: categoryId ? (categoryId as any) : undefined,
      barcode: barcode?.trim() || undefined,
      sku: sku?.trim() || undefined,
      quantity,
      costPrice,
      sellingPrice,
      lowStockThreshold,
    });
    redirect(`/store/${storeId}/inventory/${productId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create product",
    };
  }
}

export async function updateProduct(productId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = (formData.get("name") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;
  const categoryId = (formData.get("categoryId") as string) || undefined;
  const barcode = (formData.get("barcode") as string) || undefined;
  const sku = (formData.get("sku") as string) || undefined;
  const costPrice = formData.get("costPrice")
    ? Number(formData.get("costPrice"))
    : undefined;
  const sellingPrice = formData.get("sellingPrice")
    ? Number(formData.get("sellingPrice"))
    : undefined;
  const lowStockThreshold = formData.get("lowStockThreshold")
    ? Number(formData.get("lowStockThreshold"))
    : undefined;

  try {
    await convex.mutation(api.products.update, {
      productId: productId as any,
      userId: session.user.id as any,
      name: name?.trim(),
      description: description?.trim(),
      categoryId: categoryId ? (categoryId as any) : undefined,
      barcode: barcode?.trim() || undefined,
      sku: sku?.trim() || undefined,
      costPrice,
      sellingPrice,
      lowStockThreshold,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update product",
    };
  }
}

export async function archiveProduct(productId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    await convex.mutation(api.products.archive, {
      productId: productId as any,
      userId: session.user.id as any,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to archive product",
    };
  }
}

export async function restoreProduct(productId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    await convex.mutation(api.products.restore, {
      productId: productId as any,
      userId: session.user.id as any,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to restore product",
    };
  }
}

export async function adjustProductStock(
  productId: string,
  type: "manual_add" | "manual_remove",
  quantity: number,
  note?: string
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0" };
  }

  try {
    await convex.mutation(api.stockMovements.manualAdjust, {
      productId: productId as any,
      userId: session.user.id as any,
      type,
      quantity,
      note,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to adjust stock",
    };
  }
}

export async function createCategory(storeId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || undefined;

  if (!name || name.trim().length < 1) {
    return { success: false, error: "Category name is required" };
  }

  try {
    await convex.mutation(api.categories.create, {
      storeId: storeId as any,
      userId: session.user.id as any,
      name: name.trim(),
      description: description?.trim(),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create category",
    };
  }
}
