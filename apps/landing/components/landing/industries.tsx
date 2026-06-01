import { Container } from "./ui";
import { Reveal } from "./reveal";

const TAGS = [
  "Retail shops",
  "Wholesale",
  "Warehouses",
  "Multi-store chains",
  "Food & beverage",
  "Electronics",
];

export function Industries() {
  return (
    <section className="border-y border-border bg-background-subtle py-10">
      <Container>
        <Reveal>
          <div className="flex flex-col items-center gap-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Built for small &amp; medium businesses that sell things
            </p>
            <div className="flex flex-wrap justify-center gap-2.5">
              {TAGS.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
