"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
    ArrowDownToLine,
    ArrowUpFromLine,
    Download,
    FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { bulkImportProducts, ensureCategories } from "@/app/actions/inventory";
import type { Doc } from "@/convex/_generated/dataModel";

interface Props {
    storeId: string;
    categories: Doc<"categories">[];
    products: Doc<"products">[];
    canImport?: boolean;
    canExport?: boolean;
}

/** Convert Excel serial date or string → ISO YYYY-MM-DD (or return as-is) */
function parseDate(val: unknown): string {
    if (val === null || val === undefined || val === "") return "";
    if (typeof val === "number") {
        // Excel serial date (days since 1899-12-30)
        const date = new Date((val - 25569) * 86400 * 1000);
        return date.toISOString().slice(0, 10);
    }
    if (typeof val === "string") {
        const trimmed = val.trim();
        // Accept YYYY-MM-DD or DD/MM/YYYY
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
            const [d, m, y] = trimmed.split("/");
            return `${y}-${m}-${d}`;
        }
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    }
    return String(val);
}

export function InventoryImportExport({
    storeId,
    categories,
    products,
    canImport = true,
    canExport = true,
}: Props) {
    const [importOpen, setImportOpen] = useState(false);
    const [parsed, setParsed] = useState<Array<Record<string, unknown>>>([]);
    const [importing, setImporting] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const categoryByName = Object.fromEntries(
        categories.map((c) => [c.name.toLowerCase(), c._id]),
    );
    const categoryById = Object.fromEntries(
        categories.map((c) => [c._id, c.name]),
    );

    // ─── Template download ───────────────────────────────────────────────────
    function downloadTemplate() {
        const ws = XLSX.utils.aoa_to_sheet([
            [
                "Name *",
                "Description",
                "SKU",
                "Barcode",
                "Category",
                "Cost Price USD",
                "Cost Price LBP",
                "Selling Price USD",
                "Selling Price LBP",
                "Quantity",
                "Low Stock Threshold",
            ],
            [
                "Example Product",
                "A sample product",
                "PROD-001",
                "123456789",
                categories[0]?.name ?? "Electronics",
                10.0,
                "",
                24.99,
                "",
                50,
                5,
            ],
        ]);
        ws["!cols"] = [
            { wch: 24 },
            { wch: 24 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 },
            { wch: 16 },
            { wch: 10 },
            { wch: 20 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        XLSX.writeFile(wb, "inventory-template.xlsx");
    }

    // ─── Export current products ──────────────────────────────────────────────
    function exportProducts() {
        if (!products.length) {
            toast.error("No products to export");
            return;
        }
        const rows = products.map((p) => ({
            Name: p.name,
            Description: p.description ?? "",
            SKU: p.sku ?? "",
            Barcode: p.barcode ?? "",
            Category: categoryById[p.categoryId ?? ""] ?? "",
            "Cost Price USD": p.costPriceUSD ?? p.costPrice ?? "",
            "Cost Price LBP": p.costPriceLBP ?? "",
            "Selling Price USD": p.sellingPriceUSD ?? p.sellingPrice ?? "",
            "Selling Price LBP": p.sellingPriceLBP ?? "",
            Quantity: p.quantity,
            "Low Stock Threshold": p.lowStockThreshold,
            Status: p.isArchived
                ? "Archived"
                : p.quantity <= p.lowStockThreshold
                  ? "Low Stock"
                  : "In Stock",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws["!cols"] = [
            { wch: 24 },
            { wch: 24 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 },
            { wch: 14 },
            { wch: 14 },
            { wch: 16 },
            { wch: 16 },
            { wch: 10 },
            { wch: 20 },
            { wch: 12 },
        ];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Inventory");
        const date = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `inventory-${date}.xlsx`);
        toast.success(`Exported ${rows.length} products`);
    }

    // ─── Parse uploaded file ──────────────────────────────────────────────────
    function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target!.result as ArrayBuffer);
                const wb = XLSX.read(data, { type: "array", cellDates: false });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
                    ws,
                    {
                        defval: "",
                    },
                );
                setParsed(rows);
            } catch {
                toast.error(
                    "Could not parse file. Make sure it's a valid .xlsx or .csv",
                );
            }
        };
        reader.readAsArrayBuffer(file);
    }

    // ─── Run import ───────────────────────────────────────────────────────────
    async function handleImport() {
        if (!parsed.length) return;
        setImporting(true);

        // Strict whole-token header matcher (no substring fallback — that was the
        // source of the cost/selling-price collision). Returns undefined when the
        // column is absent so we can distinguish "missing column" from "blank cell".
        const get = (row: Record<string, unknown>, keys: string[]): unknown => {
            for (const k of Object.keys(row)) {
                const norm = k.toLowerCase().replace(/[^a-z]/g, "");
                if (keys.some((t) => norm === t)) return row[k];
            }
            return undefined;
        };

        const getStr = (
            row: Record<string, unknown>,
            keys: string[],
        ): string => {
            const v = get(row, keys);
            return v === undefined || v === null ? "" : String(v);
        };

        // Optional number: undefined for missing/blank/unparseable.
        const getNum = (
            row: Record<string, unknown>,
            keys: string[],
        ): number | undefined => {
            const v = get(row, keys);
            if (v === undefined || v === null || v === "") return undefined;
            const n = Number(v);
            return Number.isFinite(n) ? n : undefined;
        };

        type RawRow = {
            name: string;
            description?: string;
            sku?: string;
            barcode?: string;
            categoryName: string;
            costPriceUSD?: number;
            costPriceLBP?: number;
            sellingPriceUSD?: number;
            sellingPriceLBP?: number;
            quantity: number;
            lowStockThreshold?: number;
        };

        const raw: RawRow[] = parsed.map((row) => {
            const lst = getNum(row, [
                "lowstockthreshold",
                "lowstock",
                "threshold",
                "minstock",
            ]);
            // Legacy single-currency columns fall back into USD slot.
            const legacyCost = getNum(row, ["costprice", "cost"]);
            const legacySell = getNum(row, [
                "sellingprice",
                "sellprice",
                "saleprice",
                "salesprice",
                "price",
            ]);
            return {
                name: getStr(row, ["name", "productname", "product"]).trim(),
                description:
                    getStr(row, ["description", "desc"]).trim() || undefined,
                sku: getStr(row, ["sku"]).trim() || undefined,
                barcode:
                    getStr(row, ["barcode", "ean", "upc"]).trim() || undefined,
                categoryName: getStr(row, ["category"]).trim(),
                costPriceUSD:
                    getNum(row, ["costpriceusd", "costusd"]) ?? legacyCost,
                costPriceLBP: getNum(row, ["costpricelbp", "costlbp"]),
                sellingPriceUSD:
                    getNum(row, ["sellingpriceusd", "priceusd", "sellusd"]) ??
                    legacySell,
                sellingPriceLBP: getNum(row, [
                    "sellingpricelbp",
                    "pricelbp",
                    "selllbp",
                ]),
                quantity: Math.max(
                    0,
                    Math.floor(getNum(row, ["quantity", "qty", "stock"]) ?? 0),
                ),
                lowStockThreshold:
                    lst === undefined
                        ? undefined
                        : Math.max(0, Math.floor(lst)),
            };
        });

        // Resolve unknown categories in one batch round-trip
        const unknown = Array.from(
            new Set(
                raw
                    .map((r) => r.categoryName)
                    .filter((n) => n && !categoryByName[n.toLowerCase()]),
            ),
        );

        let resolved: Record<string, string> = { ...categoryByName };
        if (unknown.length) {
            const ec = await ensureCategories(storeId, unknown);
            if (!ec.success) {
                toast.error(ec.error);
                setImporting(false);
                return;
            }
            resolved = { ...resolved, ...ec.map };
        }

        const mapped = raw.map((r) => ({
            name: r.name,
            description: r.description,
            sku: r.sku,
            barcode: r.barcode,
            categoryId: r.categoryName
                ? resolved[r.categoryName.toLowerCase()]
                : undefined,
            costPriceUSD: r.costPriceUSD,
            costPriceLBP: r.costPriceLBP,
            sellingPriceUSD: r.sellingPriceUSD,
            sellingPriceLBP: r.sellingPriceLBP,
            quantity: r.quantity,
            lowStockThreshold: r.lowStockThreshold,
        }));

        const valid = mapped.filter(
            (p) =>
                Boolean(p.name) &&
                ((p.sellingPriceUSD ?? 0) > 0 || (p.sellingPriceLBP ?? 0) > 0),
        );
        const skipped = mapped.length - valid.length;

        if (!valid.length) {
            toast.error(
                "No valid rows found. Name and at least one selling price (USD or LBP) are required.",
            );
            setImporting(false);
            return;
        }

        const result = await bulkImportProducts(storeId, valid);
        setImporting(false);

        if (!result.success) {
            toast.error(result.error ?? "Import failed");
            return;
        }

        const parts: string[] = [];
        if (result.created) parts.push(`${result.created} created`);
        if (result.updated) parts.push(`${result.updated} updated`);
        if (skipped) parts.push(`${skipped} skipped (missing name/price)`);
        if (result.failed) parts.push(`${result.failed} failed`);

        const summary = parts.join(" · ") || "Nothing imported";

        if (result.failed && result.errors?.length) {
            toast.warning(summary, {
                description: result.errors.slice(0, 3).join("\n"),
            });
        } else {
            toast.success(summary);
        }

        setImportOpen(false);
        setParsed([]);
        if (fileRef.current) fileRef.current.value = "";
    }

    return (
        <div className="flex items-center gap-2">
            {/* Export */}
            {canExport && (
                <Button variant="outline" size="sm" onClick={exportProducts}>
                    <ArrowUpFromLine className="h-4 w-4 mr-1.5" />
                    Export
                </Button>
            )}

            {/* Import */}
            {canImport && (
                <Dialog
                    open={importOpen}
                    onOpenChange={(open) => {
                        setImportOpen(open);
                        if (!open) {
                            setParsed([]);
                            if (fileRef.current) fileRef.current.value = "";
                        }
                    }}
                >
                    <DialogTrigger
                        render={<Button variant="outline" size="sm" />}
                    >
                        <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                        Import
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle>Import Inventory</DialogTitle>
                            <DialogDescription>
                                Upload an .xlsx or .csv file. Dates must be
                                YYYY-MM-DD or DD/MM/YYYY.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Template download */}
                            <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                                <div className="flex items-center gap-2 text-sm">
                                    <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                                    <span>
                                        Download template to get started
                                    </span>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadTemplate}
                                >
                                    <Download className="h-4 w-4 mr-1.5" />
                                    Template
                                </Button>
                            </div>

                            {/* File input */}
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">
                                    Upload file
                                </label>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    onChange={handleFile}
                                    className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-input file:text-sm file:font-medium file:bg-background hover:file:bg-muted cursor-pointer"
                                />
                            </div>

                            {/* Preview */}
                            {parsed.length > 0 && (
                                <div className="rounded-lg border p-3 bg-muted/20 text-sm space-y-1">
                                    <p className="font-medium">
                                        {parsed.length} row
                                        {parsed.length !== 1 ? "s" : ""}{" "}
                                        detected
                                    </p>
                                    <p className="text-muted-foreground text-xs">
                                        Rows missing Name or Selling Price will
                                        be skipped. Unknown categories will be
                                        created automatically. Existing products
                                        (matched by SKU, barcode, or name) will
                                        have their fields updated and any
                                        quantity added as restock.
                                    </p>
                                </div>
                            )}

                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setImportOpen(false)}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleImport}
                                    disabled={!parsed.length || importing}
                                >
                                    {importing
                                        ? "Importing..."
                                        : `Import ${parsed.length || ""} rows`}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
