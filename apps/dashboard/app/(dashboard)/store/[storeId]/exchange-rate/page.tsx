"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery, useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatDate } from "@ware-house/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { friendlyMessage } from "@/lib/extract-error";
import { DollarSign, TrendingDown, TrendingUp, Activity, Info } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";

export default function ExchangeRatePage() {
    const { storeId } = useParams<{ storeId: string }>();
    const { userId } = useCurrentUser();

    const store = useQuery(
        api.stores.getById,
        userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip",
    );

    const current = useQuery(
        api.exchangeRates.getCurrent,
        userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip",
    );

    const history = usePaginatedQuery(
        api.exchangeRates.listHistory,
        userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip",
        { initialNumItems: 20 },
    );

    const setRate = useMutation(api.exchangeRates.setRate);

    const [rateStr, setRateStr] = useState("");
    const [note, setNote] = useState("");
    const [pending, setPending] = useState(false);

    const hasAccess = store?.role === "admin" || store?.role === "owner";

    const newRateNum = Number(rateStr);
    const isValidNewRate = Number.isFinite(newRateNum) && newRateNum > 0;
    const delta = useMemo(() => {
        if (!current || !isValidNewRate) return null;
        const diff = newRateNum - current.rate;
        const pct = (diff / current.rate) * 100;
        return { diff, pct };
    }, [current, isValidNewRate, newRateNum]);

    const previous = history.results[1];

    async function handleSubmit() {
        if (!isValidNewRate) {
            toast.error("Enter a positive number");
            return;
        }
        setPending(true);
        try {
            await setRate({
                storeId: storeId as Id<"stores">,
                userId: userId!,
                rate: newRateNum,
                note: note.trim() || undefined,
            });
            toast.success("Rate updated");
            setRateStr("");
            setNote("");
        } catch (e) {
            toast.error(friendlyMessage(e, "Failed to update rate"));
        } finally {
            setPending(false);
        }
    }

    return (
        <div style={{ padding: "var(--wh-density-pad)" }} className="space-y-5">
            <PageHeader
                icon={DollarSign}
                title="Exchange Rate"
                subtitle="Manage the USD ↔ LBP rate. New sales snapshot the current rate — past sales never reconvert."
            />

            <div className="grid gap-5 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-5 min-w-0">
                    <Card>
                        <CardHeader>
                            <CardTitle>Update rate</CardTitle>
                            <CardDescription>
                                {hasAccess
                                    ? "New sales after this change will use the new rate. Past sales are unaffected."
                                    : "Only store admins can change the exchange rate."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {hasAccess ? (
                                <div className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="rate">
                                                New rate (1 USD in LBP)
                                            </Label>
                                            <Input
                                                id="rate"
                                                type="number"
                                                step="1"
                                                min="0"
                                                value={rateStr}
                                                onChange={(e) => setRateStr(e.target.value)}
                                                placeholder="e.g. 90000"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="note">Note (optional)</Label>
                                            <Input
                                                id="note"
                                                value={note}
                                                onChange={(e) => setNote(e.target.value)}
                                                placeholder="Why the change?"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        onClick={handleSubmit}
                                        disabled={pending || !isValidNewRate}
                                    >
                                        {pending ? "Saving..." : "Save new rate"}
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground">
                                    Contact a store admin to change the rate.
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>History</CardTitle>
                            <CardDescription>
                                Past rate changes — most recent first.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            {history.results.length === 0 &&
                            history.status !== "LoadingFirstPage" ? (
                                <p className="p-4 text-sm text-muted-foreground">
                                    No rate changes yet.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">
                                                Rate (LBP / USD)
                                            </TableHead>
                                            <TableHead>Set by</TableHead>
                                            <TableHead>Note</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.results.map((r) => (
                                            <TableRow key={r._id}>
                                                <TableCell className="text-muted-foreground text-sm">
                                                    {formatDate(r.createdAt)}
                                                </TableCell>
                                                <TableCell className="text-right font-mono">
                                                    {r.rate.toLocaleString()}
                                                </TableCell>
                                                <TableCell>
                                                    {r.createdByName ?? "—"}
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                    {r.note ?? "—"}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                            {history.status === "CanLoadMore" && (
                                <div className="p-3 border-t">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => history.loadMore(20)}
                                    >
                                        Load more
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <aside className="space-y-5 lg:sticky lg:top-4 lg:self-start">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Activity className="h-4 w-4 text-muted-foreground" />
                                Current rate
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {current === undefined ? (
                                <Skeleton className="h-16 w-full" />
                            ) : current === null ? (
                                <p className="text-sm text-muted-foreground">
                                    No rate set yet.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    <div>
                                        <p className="text-3xl font-bold font-mono leading-tight">
                                            {current.rate.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            LBP per 1 USD
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Set {formatDate(current.createdAt)} by{" "}
                                        {current.createdByName ?? "—"}
                                        {current.note ? ` — ${current.note}` : ""}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {previous && current && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Previous rate
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <p className="font-mono text-lg">
                                    {previous.rate.toLocaleString()} LBP
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    Active until {formatDate(current.createdAt)}
                                </p>
                                {(() => {
                                    const diff = current.rate - previous.rate;
                                    const pct = (diff / previous.rate) * 100;
                                    const Icon = diff >= 0 ? TrendingUp : TrendingDown;
                                    const color = diff >= 0 ? "text-emerald-600" : "text-destructive";
                                    return (
                                        <div className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
                                            <Icon className="h-3.5 w-3.5" />
                                            {diff >= 0 ? "+" : ""}
                                            {diff.toLocaleString()} ({pct >= 0 ? "+" : ""}
                                            {pct.toFixed(2)}%)
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    )}

                    {hasAccess && isValidNewRate && delta && current && (
                        <Card className="border-primary/40">
                            <CardHeader>
                                <CardTitle className="text-base">
                                    Preview change
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2 text-sm">
                                <div className="flex items-baseline justify-between">
                                    <span className="text-muted-foreground">From</span>
                                    <span className="font-mono">
                                        {current.rate.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-muted-foreground">To</span>
                                    <span className="font-mono font-semibold">
                                        {newRateNum.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between border-t pt-2">
                                    <span className="text-muted-foreground">Δ</span>
                                    <span
                                        className={`font-medium ${delta.diff >= 0 ? "text-emerald-600" : "text-destructive"}`}
                                    >
                                        {delta.diff >= 0 ? "+" : ""}
                                        {delta.diff.toLocaleString()} (
                                        {delta.pct >= 0 ? "+" : ""}
                                        {delta.pct.toFixed(2)}%)
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                                <Info className="h-4 w-4 text-muted-foreground" />
                                How it works
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm text-muted-foreground">
                            <p>Each sale snapshots the rate at creation time.</p>
                            <p>
                                Refunds use the original sale&apos;s locked rate, not the
                                current one.
                            </p>
                            <p>Update the rate when the market moves to keep new sales accurate.</p>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    );
}
