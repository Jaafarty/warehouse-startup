import Link from "next/link";
import type { ReactNode } from "react";
import { Boxes } from "lucide-react";
import { Space_Grotesk } from "next/font/google";
import { Footer } from "@/components/landing/footer";
import { Container } from "@/components/landing/ui";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

/* Simple reading shell for static legal pages: minimal header, prose column,
   and the shared landing footer. */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`${display.variable} flex min-h-screen flex-col bg-background text-foreground`}
    >
      <header className="border-b border-border">
        <Container className="flex h-16 items-center">
          <Link
            href="/"
            className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight text-foreground"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <Boxes size={18} strokeWidth={1.75} />
            </span>
            Ware-House
          </Link>
        </Container>
      </header>

      <main className="flex-1">
        <Container className="max-w-3xl py-16 md:py-24">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold tracking-tight md:text-4xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Last updated: {updated}
          </p>
          <div className="mt-10 space-y-9">{children}</div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-foreground">{heading}</h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
