import { Check } from "lucide-react";
import { Container, Display, PrimaryCTA, SecondaryCTA } from "./ui";
import { dashboardLinks, whatsappSalesLink } from "@/lib/links";
import { Reveal, Stagger, StaggerItem } from "./reveal";

/* TODO: placeholder pricing — replace amounts/limits with your real plans. */
const TIERS = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    blurb: "For a single shop getting organized.",
    features: [
      "1 store",
      "Up to 200 products",
      "2 team members",
      "Sales, returns & basic analytics",
    ],
    cta: "Start free",
    href: dashboardLinks.signUp,
    highlight: false,
  },
  {
    name: "Growth",
    price: "$29",
    period: "/mo",
    blurb: "For growing teams that live in their numbers.",
    features: [
      "Unlimited products",
      "10 team members",
      "Customers & full analytics",
      "CSV import & export",
    ],
    cta: "Contact sales",
    href: whatsappSalesLink,
    highlight: true,
  },
  {
    name: "Business",
    price: "$79",
    period: "/mo",
    blurb: "For multi-location operations.",
    features: [
      "Multi-store",
      "Unlimited members",
      "Custom roles & permissions",
      "Priority support",
    ],
    cta: "Contact sales",
    href: whatsappSalesLink,
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <Display as="h2" className="text-3xl sm:text-4xl lg:text-5xl">
              Simple pricing that scales with you.
            </Display>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Start free. Upgrade when your store outgrows it.
            </p>
          </div>
        </Reveal>

        <Stagger className="mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-3">
          {TIERS.map((t) => (
            <StaggerItem
              key={t.name}
              className={`relative flex flex-col rounded-3xl border p-7 ${
                t.highlight
                  ? "border-primary bg-card shadow-[0_24px_60px_-28px_rgba(13,148,136,0.45)] ring-1 ring-primary/30"
                  : "border-border bg-card"
              }`}
            >
              {t.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-primary-foreground">
                  Most popular
                </span>
              )}
              <h3 className="text-base font-semibold text-foreground">
                {t.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{t.blurb}</p>
              <div className="mt-5 flex items-baseline gap-1">
                <span className="font-[family-name:var(--font-display)] text-4xl font-bold tracking-tight text-foreground">
                  {t.price}
                </span>
                <span className="text-sm text-muted-foreground">{t.period}</span>
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-[14px] text-foreground"
                  >
                    <Check
                      size={16}
                      strokeWidth={2}
                      className="mt-0.5 shrink-0 text-primary"
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-7">
                {t.highlight ? (
                  <PrimaryCTA
                    href={t.href}
                    className="w-full"
                    newTab={t.href === whatsappSalesLink}
                  >
                    {t.cta}
                  </PrimaryCTA>
                ) : (
                  <SecondaryCTA
                    href={t.href}
                    className="w-full"
                    newTab={t.href === whatsappSalesLink}
                  >
                    {t.cta}
                  </SecondaryCTA>
                )}
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
