import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { isExternalLink } from "@/lib/links";

// Renders a real <a> for cross-origin URLs (dashboard subdomain) and next/link
// for internal routes/hash links.
function CTALink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (isExternalLink(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

/* Shared landing primitives. Radius lock: primary CTA = pill, cards = rounded-3xl,
   small controls = rounded-xl. Accent lock = brand teal (--primary). One per page. */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1200px] px-6", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary",
        className
      )}
    >
      <span className="h-1 w-1 rounded-full bg-primary" />
      {children}
    </span>
  );
}

export function Display({
  as: Tag = "h2",
  className,
  children,
}: {
  as?: "h1" | "h2" | "h3";
  className?: string;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "font-[family-name:var(--font-display)] tracking-[-0.02em] text-foreground",
        className
      )}
    >
      {children}
    </Tag>
  );
}

export function PrimaryCTA({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <CTALink
      href={href}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-7 text-[15px] font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:brightness-[1.08] active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
        className
      )}
    >
      {children}
    </CTALink>
  );
}

export function SecondaryCTA({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <CTALink
      href={href}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-7 text-[15px] font-semibold text-foreground transition-all duration-200 hover:bg-muted active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
        className
      )}
    >
      {children}
    </CTALink>
  );
}
