"use client";

import Link from "next/link";
import { Boxes } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Container } from "./ui";
import { dashboardLinks, isExternalLink } from "@/lib/links";

const PRODUCT_COLUMN = {
  title: "Product",
  links: [
    { label: "Features", href: "/#features" },
    { label: "Analytics", href: "/#analytics" },
    { label: "Pricing", href: "/#pricing" },
    { label: "FAQ", href: "/#faq" },
  ],
};

const LEGAL_COLUMN = {
  title: "Legal",
  links: [
    { label: "Privacy", href: "/privacy" },
    { label: "Terms", href: "/terms" },
  ],
};

// WhatsApp chat links (digits only, no "+", drop the trunk "0", per wa.me).
const PHONE_NUMBERS = [
  { label: "+961 78972772", href: "https://wa.me/96178972772" },
  { label: "+961 03657244", href: "https://wa.me/9613657244" },
];

export function Footer() {
  // Signed-in visitors get a single "Dashboard" link; signed-out visitors get
  // the "Sign in" / "Start free" marketing links. While auth loads, fall back
  // to the signed-out links so the column is never empty.
  const { isLoaded, isSignedIn } = useAuth();

  const accountColumn = {
    title: "Account",
    links:
      isLoaded && isSignedIn
        ? [{ label: "Dashboard", href: dashboardLinks.dashboard }]
        : [
            { label: "Sign in", href: dashboardLinks.signIn },
            { label: "Start free", href: dashboardLinks.signUp },
          ],
  };

  const columns = [PRODUCT_COLUMN, accountColumn, LEGAL_COLUMN];

  return (
    <footer className="border-t border-border bg-background-subtle py-14">
      <Container>
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <div className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight text-foreground">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Boxes size={18} strokeWidth={1.75} />
              </span>
              Ware-House
            </div>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Inventory and sales management for small and medium businesses.
            </p>

            <div className="mt-6">
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Contact us
              </h4>
              <ul className="mt-3 space-y-2">
                {PHONE_NUMBERS.map((p) => (
                  <li key={p.href}>
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                    >
                      {p.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {col.title}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) =>
                  isExternalLink(l.href) ? (
                    <li key={l.label}>
                      <a
                        href={l.href}
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Ware-House. All rights reserved.
        </div>
      </Container>
    </footer>
  );
}
