import { Container, Display, Eyebrow } from "./ui";
import { Reveal, Stagger, StaggerItem } from "./reveal";

const STEPS = [
  {
    n: "01",
    title: "Create your store",
    body: "Sign up, name your store, and invite your team by email — roles set who can do what.",
  },
  {
    n: "02",
    title: "Add your inventory",
    body: "Import a spreadsheet or add products by hand. Categories and reorder points come along for the ride.",
  },
  {
    n: "03",
    title: "Sell and track",
    body: "Ring up sales, handle returns, and watch stock and analytics update in real time.",
  },
];

export function HowItWorks() {
  return (
    <section className="border-y border-border bg-background-subtle py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <Display as="h2" className="mt-5 text-3xl sm:text-4xl lg:text-5xl">
              Up and running in an afternoon.
            </Display>
          </div>
        </Reveal>

        <Stagger className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3 md:gap-6">
          {STEPS.map((s) => (
            <StaggerItem
              key={s.n}
              className="relative rounded-3xl border border-border bg-card p-7"
            >
              <span className="font-[family-name:var(--font-mono)] text-3xl font-semibold text-primary">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </StaggerItem>
          ))}
        </Stagger>
      </Container>
    </section>
  );
}
