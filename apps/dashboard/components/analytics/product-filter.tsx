"use client";

import { cn } from "@/lib/utils";

type Product = { _id: string; name: string };

export function ProductFilter({
  products,
  value,
  onChange,
}: {
  products: Product[] | undefined;
  value: string | null;
  onChange: (productId: string | null) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      disabled={!products}
      className={cn(
        "h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs",
        "focus:outline-none focus:ring-1 focus:ring-ring",
        "disabled:opacity-50"
      )}
    >
      <option value="">All products</option>
      {products?.map((p) => (
        <option key={p._id} value={p._id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
