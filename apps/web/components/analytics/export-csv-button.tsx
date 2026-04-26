"use client";

import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import type { DailyRow } from "./daily-summary-table";

function escapeCsv(v: string | number): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function ExportCsvButton({
  rows,
  filename,
  disabled,
}: {
  rows: DailyRow[] | undefined;
  filename: string;
  disabled?: boolean;
}) {
  const handleDownload = () => {
    if (!rows) return;
    const header = ["Date", "Orders", "Revenue", "Avg Order Value"];
    const body = rows.map((r) => [
      r.date,
      r.orders,
      r.revenue.toFixed(2),
      r.avgOrderValue.toFixed(2),
    ]);
    const csv = [header, ...body]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={disabled || !rows || rows.length === 0}
      className="gap-1.5"
    >
      <Download className="h-3.5 w-3.5" />
      Export CSV
    </Button>
  );
}
