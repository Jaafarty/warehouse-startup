"use client";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

export type RangePreset = "today" | "7d" | "30d" | "month" | "custom";

export type DateRange = {
  start: number;
  end: number;
  preset: RangePreset;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts: number): number {
  return startOfDay(ts) + DAY_MS;
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function presetRange(preset: RangePreset): DateRange {
  const now = Date.now();
  const today = startOfDay(now);
  switch (preset) {
    case "today":
      return { start: today, end: today + DAY_MS, preset };
    case "7d":
      return { start: today - 6 * DAY_MS, end: today + DAY_MS, preset };
    case "30d":
      return { start: today - 29 * DAY_MS, end: today + DAY_MS, preset };
    case "month":
      return { start: startOfMonth(now), end: today + DAY_MS, preset };
    case "custom":
      return { start: today - 29 * DAY_MS, end: today + DAY_MS, preset };
  }
}

function formatInputDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRESETS: { key: RangePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "month", label: "This Month" },
];

export function RangeFilter({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const [openCustom, setOpenCustom] = useState(false);
  const [customStart, setCustomStart] = useState(formatInputDate(value.start));
  const [customEnd, setCustomEnd] = useState(formatInputDate(value.end - 1));

  const applyCustom = () => {
    const s = new Date(customStart);
    const e = new Date(customEnd);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return;
    onChange({
      start: startOfDay(s.getTime()),
      end: endOfDay(e.getTime()),
      preset: "custom",
    });
    setOpenCustom(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Button
          key={p.key}
          variant={value.preset === p.key ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(presetRange(p.key))}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={openCustom} onOpenChange={setOpenCustom}>
        <PopoverTrigger
          render={
            <Button
              variant={value.preset === "custom" ? "default" : "outline"}
              size="sm"
              className={cn("gap-1.5")}
            />
          }
        >
          <CalendarIcon className="h-3.5 w-3.5" />
          {value.preset === "custom"
            ? `${formatInputDate(value.start)} → ${formatInputDate(value.end - 1)}`
            : "Custom"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-3">
          <div className="grid gap-2">
            <Label htmlFor="rf-start" className="text-xs">
              Start date
            </Label>
            <Input
              id="rf-start"
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="rf-end" className="text-xs">
              End date
            </Label>
            <Input
              id="rf-end"
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={applyCustom}>
            Apply
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
