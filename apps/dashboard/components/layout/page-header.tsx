"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

type HeaderStyle = "card" | "gradient" | "plain";
type HeaderPattern = "grid" | "dots" | "stripes" | "blobs" | "none";

interface PageHeaderProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  /** Override the fixed gradient style for this page. */
  styleOverride?: HeaderStyle;
  patternOverride?: HeaderPattern;
  className?: string;
}

function patternToClass(pattern: HeaderPattern): string {
  switch (pattern) {
    case "grid":
      return "wh-pattern-grid";
    case "dots":
      return "wh-pattern-dots";
    case "stripes":
      return "wh-pattern-stripes";
    case "blobs":
      return "wh-pattern-blobs";
    case "none":
    default:
      return "";
  }
}

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  right,
  styleOverride,
  patternOverride,
  className,
}: PageHeaderProps) {
  // Fixed app style: gradient header with a stripes pattern.
  const headerStyle: HeaderStyle = styleOverride ?? "gradient";
  const pattern: HeaderPattern = patternOverride ?? "stripes";
  const patternClass = patternToClass(pattern);

  const isPlain = headerStyle === "plain";
  const isGradient = headerStyle === "gradient";

  return (
    <div
      className={cn(
        "relative overflow-hidden mb-5",
        !isPlain && "wh-card",
        className
      )}
      style={
        isPlain
          ? undefined
          : {
              borderRadius: "var(--radius-xl)",
              border: "1px solid var(--border)",
              background: isGradient
                ? "linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%)"
                : "var(--card)",
              boxShadow: isPlain ? "none" : "var(--shadow-card)",
            }
      }
    >
      {/* Geometric pattern layer */}
      {!isPlain && pattern !== "none" && (
        <div
          aria-hidden
          className={cn("absolute inset-0 pointer-events-none", patternClass)}
          style={{
            maskImage:
              "linear-gradient(to bottom right, rgba(0,0,0,0.55), rgba(0,0,0,0))",
            WebkitMaskImage:
              "linear-gradient(to bottom right, rgba(0,0,0,0.55), rgba(0,0,0,0))",
          }}
        />
      )}

      <div
        className={cn(
          "relative flex flex-wrap items-center gap-3 sm:gap-4",
          isPlain ? "py-4" : "px-4 py-4 sm:px-6 sm:py-5",
          right ? "justify-between" : "justify-start"
        )}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          {Icon && !isPlain && (
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl text-white flex-shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary), oklch(0.62 0.16 165))",
                boxShadow: "0 4px 12px oklch(0.58 0.13 195 / 0.30)",
              }}
            >
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="wh-h1 tracking-tight">{title}</h1>
            {subtitle && <div className="wh-body-muted mt-1">{subtitle}</div>}
          </div>
        </div>
        {right && (
          <div className="flex items-center gap-2 flex-shrink-0">{right}</div>
        )}
      </div>
    </div>
  );
}
