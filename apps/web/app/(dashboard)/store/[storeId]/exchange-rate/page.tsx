"use client";

import { useState } from "react";
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

export default function ExchangeRatePage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );

  const current = useQuery(
    api.exchangeRates.getCurrent,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip"
  );

  const history = usePaginatedQuery(
    api.exchangeRates.listHistory,
    userId ? { storeId: storeId as Id<"stores">, userId: userId } : "skip",
    { initialNumItems: 20 }
  );

  const setRate = useMutation(api.exchangeRates.setRate);

  const [rateStr, setRateStr] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  const isAdmin = store?.role === "admin";

  async function handleSubmit() {
    const rate = Number(rateStr);
    if (!Number.isFinite(rate) || rate <= 0) {
      toast.error("Enter a positive number");
      return;
    }
    setPending(true);
    try {
      await setRate({
        storeId: storeId as Id<"stores">,
        userId: userId!,
        rate,
        note: note.trim() || undefined,
      });
      toast.success("Rate updated");
      setRateStr("");
      setNote("");
    } catch (e) {
      toast.error((e as Error)?.message ?? "Failed to update rate");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exchange Rate</h1>
        <p className="text-muted-foreground text-sm">
          Manage the USD ↔ LBP rate. New sales snapshot the current rate at
          creation time — past sales are never reconverted.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current rate</CardTitle>
        </CardHeader>
        <CardContent>
          {current === undefined ? (
            <Skeleton className="h-12 w-48" />
          ) : current === null ? (
            <p className="text-muted-foreground">No rate set yet.</p>
          ) : (
            <div>
              <p className="text-3xl font-bold font-mono">
                1 USD = {current.rate.toLocaleString()} LBP
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Set {formatDate(current.createdAt)} by{" "}
                {current.createdByName ?? "—"}
                {current.note ? ` — ${current.note}` : ""}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update rate</CardTitle>
          <CardDescription>
            {isAdmin
              ? "New sales after this change will use the new rate. Past sales are unaffected."
              : "Only store admins can change the exchange rate."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAdmin ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rate">New rate (1 USD in LBP)</Label>
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
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why are you changing the rate?"
                />
              </div>
              <Button onClick={handleSubmit} disabled={pending || !rateStr}>
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
        </CardHeader>
        <CardContent className="p-0">
          {history.results.length === 0 && history.status !== "LoadingFirstPage" ? (
            <p className="p-4 text-sm text-muted-foreground">
              No rate changes yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Rate (LBP / USD)</TableHead>
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
                    <TableCell>{r.createdByName ?? "—"}</TableCell>
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
  );
}
