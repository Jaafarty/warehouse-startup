import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Container, Display } from "./ui";
import { Reveal, Parallax } from "./reveal";
import { InventoryPreview, SalesPreview } from "./previews";

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-6 space-y-3">
      {items.map((t) => (
        <li key={t} className="flex items-start gap-3 text-[15px] text-foreground">
          <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Check size={13} strokeWidth={2.25} />
          </span>
          {t}
        </li>
      ))}
    </ul>
  );
}

function Row({
  kicker,
  title,
  body,
  bullets,
  visual,
  flip,
}: {
  kicker: string;
  title: ReactNode;
  body: string;
  bullets: string[];
  visual: ReactNode;
  flip?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <Reveal className={flip ? "lg:order-2" : undefined}>
        <p className="text-sm font-semibold text-primary">{kicker}</p>
        <Display as="h3" className="mt-3 text-3xl sm:text-4xl">
          {title}
        </Display>
        <p className="mt-4 max-w-[48ch] text-[15px] leading-relaxed text-muted-foreground">
          {body}
        </p>
        <Bullets items={bullets} />
      </Reveal>

      <Reveal
        delay={0.1}
        className={flip ? "lg:order-1" : undefined}
        y={28}
      >
        <Parallax amount={22}>{visual}</Parallax>
      </Reveal>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <Display as="h2" className="text-3xl sm:text-4xl lg:text-5xl">
              Everything your store runs on, connected.
            </Display>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Stock, sales, returns, and customers share one source of truth — so
              the numbers always agree.
            </p>
          </div>
        </Reveal>

        <div className="mt-20 space-y-24 md:space-y-32">
          <Row
            kicker="Inventory"
            title="Know what you have, down to the unit."
            body="Every stock change — sales, returns, manual adjustments — flows through one ledger and updates quantities instantly. No more guessing what's on the shelf."
            bullets={[
              "Stock movements that always reconcile",
              "Categories, SKUs, and reorder points",
              "Bulk spreadsheet import & export",
            ]}
            visual={<InventoryPreview />}
          />
          <Row
            flip
            kicker="Sales & Returns"
            title="Sell fast, return cleanly."
            body="Ring up a cart and stock decrements atomically. Process returns as first-class records with per-item quantities and reasons — stock reverses automatically."
            bullets={[
              "Cart checkout with atomic stock decrement",
              "First-class returns, per-item quantities",
              "Sale numbers + optional customer linking",
            ]}
            visual={<SalesPreview />}
          />
        </div>
      </Container>
    </section>
  );
}
