"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useCurrentUser } from "@/lib/use-current-user";
import { useQuery } from "convex/react";
import { useParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { recordCash } from "@/app/actions/shifts";
import { formatCurrency, formatDate } from "@ware-house/shared";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet,
  Search,
  TrendingUp,
  X,
  Plus,
  Minus,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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

// Preset reason categories sourced from the prototype design.
const REASONS_IN = [
  { value: "sale_cash", label: "Cash sale" },
  { value: "owner_deposit", label: "Owner deposit" },
  { value: "refund_reverse", label: "Refund reversal" },
  { value: "other_in", label: "Other income" },
] as const;

const REASONS_OUT = [
  { value: "supplier", label: "Supplier payment" },
  { value: "utilities", label: "Utilities / rent" },
  { value: "wages", label: "Wages" },
  { value: "petty_cash", label: "Petty cash" },
  { value: "refund_paid", label: "Refund paid" },
  { value: "owner_draw", label: "Owner draw" },
  { value: "other_out", label: "Other expense" },
] as const;

const REASON_LABELS: Record<string, string> = Object.fromEntries(
  [...REASONS_IN, ...REASONS_OUT].map((r) => [r.value, r.label])
);

function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

function tsToDateInput(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export default function CashPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { userId } = useCurrentUser();

  const store = useQuery(
    api.stores.getById,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const isPrivileged = store?.role === "owner" || store?.role === "admin";
  const fns = store?.effectivePermissions?.cash?.functions ?? {};
  const can = (fn: string) => isPrivileged || (fns[fn] ?? false);
  const canRecordIn = can("record_in");
  const canRecordOut = can("record_out");

  const drawer = useQuery(
    api.shifts.getStoreDrawer,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  // Per-register drawers (empty when the store has no registers defined).
  const registerDrawers = useQuery(
    api.shifts.getRegisterDrawers,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );
  const hasRegisters = (registerDrawers?.length ?? 0) > 0;

  const activeShift = useQuery(
    api.shifts.getActive,
    userId ? { storeId: storeId as Id<"stores">, userId } : "skip"
  );

  const shiftDetail = useQuery(
    api.shifts.get,
    userId && activeShift ? { shiftId: activeShift._id, userId } : "skip"
  );

  const cashEvents = useQuery(
    api.shifts.listStoreCashEvents,
    userId
      ? { storeId: storeId as Id<"stores">, userId, limit: 200 }
      : "skip"
  );

  // ── Filters ──────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // ── KPIs (today) ─────────────────────────────────────────
  const kpis = useMemo(() => {
    if (!cashEvents) return null;
    let inUSD = 0,
      inLBP = 0,
      outUSD = 0,
      outLBP = 0,
      inCount = 0,
      outCount = 0;
    for (const e of cashEvents) {
      if (!isToday(e.createdAt)) continue;
      if (e.type === "manual_in") {
        inUSD += Math.abs(e.amountUSD);
        inLBP += Math.abs(e.amountLBP);
        inCount++;
      } else if (e.type === "manual_out") {
        outUSD += Math.abs(e.amountUSD);
        outLBP += Math.abs(e.amountLBP);
        outCount++;
      }
    }
    return {
      inUSD,
      inLBP,
      outUSD,
      outLBP,
      inCount,
      outCount,
      netUSD: inUSD - outUSD,
      netLBP: inLBP - outLBP,
    };
  }, [cashEvents]);

  // ── Filtered table data ──────────────────────────────────
  const filteredEvents = useMemo(() => {
    if (!cashEvents) return [];
    return cashEvents.filter((e) => {
      if (typeFilter !== "all") {
        const t = e.type === "manual_in" ? "in" : "out";
        if (t !== typeFilter) return false;
      }
      if (fromDate && tsToDateInput(e.createdAt) < fromDate) return false;
      if (toDate && tsToDateInput(e.createdAt) > toDate) return false;
      if (search) {
        const q = search.toLowerCase();
        const reason = (e.reason ?? "").toLowerCase();
        const by = (e.performedByName ?? "").toLowerCase();
        if (!reason.includes(q) && !by.includes(q)) return false;
      }
      return true;
    });
  }, [cashEvents, typeFilter, fromDate, toDate, search]);

  const dateActive = !!(fromDate || toDate);
  const drawerUSD = drawer?.drawerUSD ?? 0;
  const drawerLBP = drawer?.drawerLBP ?? 0;

  // ── Modal state ──────────────────────────────────────────
  const [openModal, setOpenModal] = useState<"in" | "out" | null>(null);

  return (
    <div
      style={{ padding: "var(--wh-density-pad)" }}
      className="space-y-5"
    >
      <PageHeader
        icon={Wallet}
        title="Cash"
        subtitle="Track cash in, cash out, and your current drawer balance."
        right={
          <>
            {canRecordOut && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpenModal("out")}
                style={{
                  borderColor: "var(--destructive)",
                  color: "var(--destructive)",
                }}
              >
                <ArrowUpFromLine className="h-4 w-4 mr-1.5" />
                Cash Out
              </Button>
            )}
            {canRecordIn && (
              <Button
                size="sm"
                onClick={() => setOpenModal("in")}
                style={{
                  background: "var(--color-success)",
                  color: "var(--primary-foreground)",
                }}
              >
                <ArrowDownToLine className="h-4 w-4 mr-1.5" />
                Cash In
              </Button>
            )}
          </>
        }
      />

      {/* KPI grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <KpiCard
          label="Drawer Balance"
          valueUSD={drawerUSD}
          valueLBP={drawerLBP}
          sub="Current cash on hand"
          icon={<Wallet className="h-[17px] w-[17px]" />}
          accent={{
            fg: "var(--primary)",
            bg: "var(--primary-soft)",
          }}
          loading={drawer === undefined}
        />
        <KpiCard
          label="Cash In (Today)"
          valueUSD={kpis?.inUSD ?? 0}
          valueLBP={kpis?.inLBP ?? 0}
          sub={kpis ? `${kpis.inCount} transaction${kpis.inCount === 1 ? "" : "s"}` : "—"}
          icon={<ArrowDownToLine className="h-[17px] w-[17px]" />}
          accent={{
            fg: "var(--color-success)",
            bg: "var(--color-success-bg)",
          }}
          loading={kpis === null}
        />
        <KpiCard
          label="Cash Out (Today)"
          valueUSD={kpis?.outUSD ?? 0}
          valueLBP={kpis?.outLBP ?? 0}
          sub={kpis ? `${kpis.outCount} transaction${kpis.outCount === 1 ? "" : "s"}` : "—"}
          icon={<ArrowUpFromLine className="h-[17px] w-[17px]" />}
          accent={{
            fg: "var(--destructive)",
            bg: "oklch(0.94 0.04 27)",
          }}
          loading={kpis === null}
        />
        <KpiCard
          label="Net (Today)"
          valueUSD={kpis?.netUSD ?? 0}
          valueLBP={kpis?.netLBP ?? 0}
          netSign
          sub={
            kpis
              ? (kpis.netUSD >= 0 ? "Net inflow" : "Net outflow")
              : "—"
          }
          icon={<TrendingUp className="h-[17px] w-[17px]" />}
          accent={{
            fg: "var(--accent-foreground)",
            bg: "var(--accent-soft)",
          }}
          loading={kpis === null}
        />
      </div>

      {/* Per-register drawers (only when the store has registers defined) */}
      {hasRegisters && (
        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Registers
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {registerDrawers!.map((c) => (
              <div
                key={c.registerId}
                className="wh-card px-4 py-3.5"
                style={{
                  background: "var(--card)",
                  borderRadius: "var(--radius-xl)",
                  boxShadow: "var(--shadow-card)",
                  border: "1px solid var(--border)",
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold truncate">
                    {c.name}
                  </span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded"
                    style={{
                      background: c.openShift
                        ? "var(--primary-soft)"
                        : "var(--muted)",
                      color: c.openShift
                        ? "var(--primary)"
                        : "var(--muted-foreground)",
                    }}
                  >
                    {c.openShift ? "Open" : "Closed"}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-mono text-[15px] font-semibold">
                    {formatCurrency(c.drawerUSD, "USD")}
                  </span>
                  <span className="font-mono text-[13px] text-muted-foreground">
                    {formatCurrency(c.drawerLBP, "LBP")}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground truncate">
                  {c.openShift
                    ? `Held by ${c.openShift.openedByName ?? "—"}`
                    : "No open shift"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active shift mini-card (preserved from original) */}
      {activeShift && shiftDetail && (
        <div
          className="wh-card flex flex-wrap items-center justify-between gap-4 px-5 py-4"
          style={{
            background: "var(--card)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-card)",
            border: "1px solid var(--border)",
          }}
        >
          <div className="flex flex-col gap-0.5">
            <div className="text-[13px] font-semibold text-foreground">
              Active shift sub-total
            </div>
            <div className="text-[11px] text-muted-foreground">
              Opened {formatDate(activeShift.openedAt)}
            </div>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Shift USD
              </div>
              <div className="font-mono text-[15px] font-semibold">
                {formatCurrency(shiftDetail.totals.expectedClosingUSD, "USD")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Shift LBP
              </div>
              <div className="font-mono text-[15px] font-semibold">
                {formatCurrency(shiftDetail.totals.expectedClosingLBP, "LBP")}
              </div>
            </div>
            <Link href={`/store/${storeId}/shifts/${activeShift._id}`}>
              <Button variant="outline" size="sm">
                View shift
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reason or member…"
            className="pl-9"
          />
        </div>
        <div className="inline-flex items-center gap-1.5">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            aria-label="From date"
            className="w-[158px]"
          />
          <span className="text-[12px] text-muted-foreground">–</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            aria-label="To date"
            className="w-[158px]"
          />
          {dateActive && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              aria-label="Clear date range"
              className="h-9 w-9"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <SegmentedTypeFilter value={typeFilter} onChange={setTypeFilter} />
      </div>

      {/* Transactions */}
      <div
        className="overflow-hidden"
        style={{
          background: "var(--card)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-card)",
          border: "1px solid var(--border)",
        }}
      >
        {cashEvents === undefined ? (
          <div className="p-6 space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-xl text-muted-foreground"
              style={{ background: "var(--secondary)" }}
            >
              <Wallet className="h-6 w-6" />
            </div>
            <div className="text-[15px] font-semibold mb-1.5">
              No transactions
            </div>
            <div className="text-[13px] text-muted-foreground">
              Record your first cash in or cash out to get started.
            </div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">USD</TableHead>
                <TableHead className="text-right">LBP</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Shift</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEvents.map((e) => {
                const isIn = e.type === "manual_in";
                return (
                  <TableRow key={e._id}>
                    <TableCell className="font-mono text-[12px] whitespace-nowrap text-muted-foreground">
                      {formatDate(e.createdAt)}
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={isIn ? "in" : "out"} />
                    </TableCell>
                    <TableCell>
                      <ReasonBadge raw={e.reason} type={isIn ? "in" : "out"} />
                    </TableCell>
                    <TableCell
                      className="text-right font-mono font-bold"
                      style={{
                        color: isIn
                          ? "var(--color-success)"
                          : "var(--destructive)",
                      }}
                    >
                      {e.amountUSD === 0
                        ? "—"
                        : (e.amountUSD >= 0 ? "+" : "") +
                          formatCurrency(e.amountUSD, "USD")}
                    </TableCell>
                    <TableCell
                      className="text-right font-mono font-bold"
                      style={{
                        color: isIn
                          ? "var(--color-success)"
                          : "var(--destructive)",
                      }}
                    >
                      {e.amountLBP === 0
                        ? "—"
                        : (e.amountLBP >= 0 ? "+" : "") +
                          formatCurrency(e.amountLBP, "LBP")}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {e.performedByName}
                    </TableCell>
                    <TableCell className="text-[13px] text-muted-foreground">
                      {e.shiftId ? (
                        <Link
                          href={`/store/${storeId}/shifts/${e.shiftId}`}
                          className="underline"
                        >
                          shift
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Cash In/Out modals */}
      {openModal && (
        <CashEntryModal
          kind={openModal}
          storeId={storeId}
          onClose={() => setOpenModal(null)}
        />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  KPI Card
// ────────────────────────────────────────────────────────────
function KpiCard({
  label,
  valueUSD,
  valueLBP,
  sub,
  icon,
  accent,
  loading = false,
  netSign = false,
}: {
  label: string;
  valueUSD: number;
  valueLBP: number;
  sub?: string;
  icon: React.ReactNode;
  accent: { fg: string; bg: string };
  loading?: boolean;
  netSign?: boolean;
}) {
  const usdLabel = netSign
    ? (valueUSD >= 0 ? "+" : "−") +
      formatCurrency(Math.abs(valueUSD), "USD").replace(/^\$/, "$")
    : formatCurrency(valueUSD, "USD");

  return (
    <div
      className="wh-card flex justify-between items-start gap-3 p-5"
      style={{
        background: "var(--card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "var(--shadow-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium text-muted-foreground mb-2">
          {label}
        </div>
        {loading ? (
          <Skeleton className="h-7 w-24" />
        ) : (
          <>
            <div
              className="font-bold leading-none tracking-tight"
              style={{ fontSize: 24, color: "var(--foreground)" }}
            >
              {usdLabel}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground mt-1.5">
              {(netSign ? (valueLBP >= 0 ? "+" : "−") : "") +
                formatCurrency(Math.abs(valueLBP), "LBP")}
            </div>
          </>
        )}
        {sub && (
          <div className="text-[11px] text-muted-foreground mt-1.5">{sub}</div>
        )}
      </div>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-md flex-shrink-0"
        style={{ background: accent.bg, color: accent.fg }}
      >
        {icon}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Type badge
// ────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: "in" | "out" }) {
  const isIn = type === "in";
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[24px] rounded-full px-2.5 text-[11px] font-bold"
      style={{
        background: isIn ? "var(--color-success-bg)" : "oklch(0.96 0.025 27)",
        color: isIn ? "var(--color-success)" : "var(--destructive)",
      }}
    >
      {isIn ? (
        <ArrowDownToLine className="h-3 w-3" />
      ) : (
        <ArrowUpFromLine className="h-3 w-3" />
      )}
      {isIn ? "IN" : "OUT"}
    </span>
  );
}

// ────────────────────────────────────────────────────────────
//  Reason badge — resolves preset slugs to labels; falls back to raw.
// ────────────────────────────────────────────────────────────
function ReasonBadge({
  raw,
  type,
}: {
  raw: string | undefined;
  type: "in" | "out";
}) {
  const isIn = type === "in";
  const text = useReadableReason(raw);
  return (
    <span
      className="inline-flex items-center gap-1.5 h-[22px] rounded-full px-2.5 text-[11px] font-semibold"
      style={{
        background: isIn ? "var(--color-success-bg)" : "oklch(0.96 0.025 27)",
        color: isIn ? "var(--color-success)" : "var(--destructive)",
      }}
    >
      <span
        className="h-[6px] w-[6px] rounded-full"
        style={{
          background: isIn ? "var(--color-success)" : "var(--destructive)",
        }}
      />
      {text || "—"}
    </span>
  );
}

function useReadableReason(raw: string | undefined): string {
  if (!raw) return "";
  // Stored format: "{label}" or "{label} — {note}". Split on the em-dash separator.
  const [head] = raw.split(" — ");
  // If head matches a preset slug, prefer the label; otherwise show raw head.
  return REASON_LABELS[head] ?? head;
}

// ────────────────────────────────────────────────────────────
//  Segmented IN/OUT/All filter
// ────────────────────────────────────────────────────────────
function SegmentedTypeFilter({
  value,
  onChange,
}: {
  value: "all" | "in" | "out";
  onChange: (v: "all" | "in" | "out") => void;
}) {
  const options: { v: "all" | "in" | "out"; label: string }[] = [
    { v: "all", label: "All" },
    { v: "in", label: "Cash In" },
    { v: "out", label: "Cash Out" },
  ];
  return (
    <div
      className="inline-flex p-[3px] gap-0.5 rounded-lg border"
      style={{
        background: "var(--card)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-xs)",
      }}
    >
      {options.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            className="h-[30px] px-3.5 rounded-md text-[12px] font-semibold border-none cursor-pointer transition"
            style={{
              background: active ? "var(--secondary)" : "transparent",
              color: active ? "var(--foreground)" : "var(--muted-foreground)",
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  Cash In / Cash Out modal
// ────────────────────────────────────────────────────────────
function CashEntryModal({
  kind,
  storeId,
  onClose,
}: {
  kind: "in" | "out";
  storeId: string;
  onClose: () => void;
}) {
  const isIn = kind === "in";
  const reasons = isIn ? REASONS_IN : REASONS_OUT;

  const [reasonValue, setReasonValue] = useState<string>(reasons[0].value);
  const [note, setNote] = useState("");
  const [usd, setUsd] = useState("");
  const [lbp, setLbp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const usdNum = Number(usd || "0");
  const lbpNum = Number(lbp || "0");
  const valid =
    (usdNum > 0 || lbpNum > 0) &&
    Number.isFinite(usdNum) &&
    Number.isFinite(lbpNum);

  const accentFg = isIn ? "var(--color-success)" : "var(--destructive)";
  const accentBg = isIn ? "var(--color-success-bg)" : "oklch(0.94 0.04 27)";

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!valid) return;
    const label = REASON_LABELS[reasonValue] ?? reasonValue;
    const reasonText = note.trim() ? `${label} — ${note.trim()}` : label;
    setSubmitting(true);
    const res = await recordCash(storeId, kind, usdNum, lbpNum, reasonText);
    setSubmitting(false);
    if (!res.success) {
      toast.error(res.error ?? "Failed to record");
      return;
    }
    toast.success(isIn ? "Cash in recorded" : "Cash out recorded");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[480px] overflow-hidden p-0">
        {/* Accent bar */}
        <div className="h-1 w-full" style={{ background: accentFg }} />

        <div className="px-6 pt-5 pb-6 space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-lg flex-shrink-0"
                style={{ background: accentBg, color: accentFg }}
              >
                {isIn ? (
                  <ArrowDownToLine className="h-5 w-5" />
                ) : (
                  <ArrowUpFromLine className="h-5 w-5" />
                )}
              </div>
              <div className="flex flex-col text-left">
                <DialogTitle className="text-[17px] tracking-tight">
                  {isIn ? "Cash In" : "Cash Out"}
                </DialogTitle>
                <DialogDescription className="text-[12px]">
                  {isIn
                    ? "Record money added to the drawer."
                    : "Record money taken from the drawer."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Amount inputs — prominent */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="cash-usd"
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  USD
                </Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
                    $
                  </span>
                  <Input
                    id="cash-usd"
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    value={usd}
                    onChange={(e) => setUsd(e.target.value)}
                    placeholder="0.00"
                    className="pl-8 h-12 text-xl font-mono font-bold tracking-tight"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="cash-lbp"
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                >
                  LBP
                </Label>
                <Input
                  id="cash-lbp"
                  type="number"
                  step="1"
                  min="0"
                  inputMode="decimal"
                  value={lbp}
                  onChange={(e) => setLbp(e.target.value)}
                  placeholder="0"
                  className="h-12 text-xl font-mono font-bold tracking-tight"
                />
              </div>
            </div>

            {/* Reason chips */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Reason
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {reasons.map((r) => {
                  const active = reasonValue === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReasonValue(r.value)}
                      className="h-8 px-3 rounded-full text-[12px] font-semibold border transition cursor-pointer"
                      style={{
                        background: active ? accentBg : "var(--card)",
                        color: active ? accentFg : "var(--muted-foreground)",
                        borderColor: active ? accentFg : "var(--border)",
                      }}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <Label
                htmlFor="cash-note"
                className="text-[10px] uppercase tracking-wider text-muted-foreground"
              >
                Note{" "}
                <span className="font-normal normal-case tracking-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="cash-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  isIn
                    ? "Reference, e.g. S-20260512-0008"
                    : "Reference, e.g. Supplier invoice #4421"
                }
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!valid || submitting}
                style={{
                  background: accentFg,
                  color: "var(--primary-foreground)",
                }}
              >
                {isIn ? (
                  <Plus className="h-4 w-4 mr-1.5" />
                ) : (
                  <Minus className="h-4 w-4 mr-1.5" />
                )}
                {submitting ? "Saving…" : isIn ? "Cash In" : "Cash Out"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
