"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getTweaks,
  subscribeTweaks,
  setTweak,
  type Density,
  type HeaderPattern,
  type HeaderStyle,
} from "./tweaks-store";

const HEADER_STYLES: { value: HeaderStyle; label: string }[] = [
  { value: "card", label: "Card" },
  { value: "gradient", label: "Gradient" },
  { value: "plain", label: "Plain" },
];

const PATTERNS: { value: HeaderPattern; label: string }[] = [
  { value: "grid", label: "Grid" },
  { value: "dots", label: "Dot field" },
  { value: "blobs", label: "Soft blobs" },
  { value: "stripes", label: "Stripes" },
  { value: "none", label: "None" },
];

const DENSITIES: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "comfy", label: "Comfy" },
  { value: "spacious", label: "Spacious" },
];

function SegmentedRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div
      className="inline-flex p-1 border border-border rounded-lg gap-0.5 w-full"
      style={{ background: "var(--background-subtle)" }}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "flex-1 h-8 px-2.5 rounded-md text-[12px] font-medium border-none cursor-pointer transition",
              active
                ? "bg-card text-foreground"
                : "bg-transparent text-muted-foreground hover:text-foreground"
            )}
            style={
              active
                ? {
                    boxShadow: "var(--shadow-xs)",
                    fontWeight: 600,
                  }
                : undefined
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function SelectRow<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="w-full h-9 rounded-lg border bg-card px-3 text-[13px] text-foreground outline-none focus-visible:border-primary"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function TweaksPanel() {
  const tweaks = useSyncExternalStore(subscribeTweaks, getTweaks, getTweaks);
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open tweaks panel"
        className="fixed z-40 bottom-5 right-5 h-11 w-11 rounded-full text-white border-none cursor-pointer flex items-center justify-center transition hover:scale-105 active:scale-100"
        style={{
          background: "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
          boxShadow: "0 6px 20px oklch(0.58 0.13 195 / 0.4)",
        }}
      >
        <Sparkles className="h-5 w-5" />
      </button>

      {/* Panel */}
      {open && (
        <div
          className="fixed z-50 bottom-20 right-5 w-[320px] max-w-[calc(100vw-2.5rem)]"
          style={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)",
            boxShadow: "var(--shadow-popover)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: "var(--primary)" }} />
              <span className="text-[14px] font-semibold text-foreground">
                Tweaks
              </span>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="h-7 w-7 rounded-md bg-transparent border-none cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground transition flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
            <Section
              title="Page headers"
              desc="Reshape how titles introduce each page."
            >
              <Field label="Style">
                <SegmentedRow
                  value={tweaks.headerStyle}
                  options={HEADER_STYLES}
                  onChange={(v) => setTweak("headerStyle", v)}
                />
              </Field>
              <Field label="Background pattern">
                <SelectRow
                  value={tweaks.headerPattern}
                  options={PATTERNS}
                  onChange={(v) => setTweak("headerPattern", v)}
                />
              </Field>
            </Section>

            <Section title="Density" desc="Inner spacing across every page.">
              <SegmentedRow
                value={tweaks.density}
                options={DENSITIES}
                onChange={(v) => setTweak("density", v)}
              />
            </Section>
          </div>
        </div>
      )}
    </>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <div className="text-[12px] font-semibold text-foreground">{title}</div>
        {desc && (
          <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
        )}
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      {children}
    </div>
  );
}
