"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";
import { Container, Display } from "./ui";
import { Reveal } from "./reveal";

const FAQS = [
  {
    q: "Do I need to install anything?",
    a: "No. Ware-House runs in your browser and updates in real time for everyone on your team at once.",
  },
  {
    q: "Can I import my existing products?",
    a: "Yes — upload a spreadsheet and Ware-House matches or creates products and categories automatically.",
  },
  {
    q: "How do permissions work?",
    a: "Built-in roles (owner, admin, employee, viewer) plus custom roles you can scope down to specific pages and functions.",
  },
  {
    q: "Does it handle multiple currencies?",
    a: "Yes. Set a USD/LBP exchange rate per store and keep a full history of every rate change.",
  },
  {
    q: "Can I run more than one store?",
    a: "Absolutely. Manage many locations from one account, each with its own team, stock, and reports.",
  },
  {
    q: "Is there a free plan?",
    a: "Yes. Start free with no card required, and upgrade only when your store outgrows it.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="border-t border-border py-24 md:py-32">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <Reveal>
            <Display as="h2" className="text-3xl sm:text-4xl lg:text-5xl lg:sticky lg:top-28">
              Questions,
              <br className="hidden lg:block" /> answered.
            </Display>
          </Reveal>

          <Reveal delay={0.1}>
            <ul className="divide-y divide-border border-y border-border">
              {FAQS.map((item, i) => {
                const isOpen = open === i;
                return (
                  <li key={item.q}>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : i)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-4 py-5 text-left"
                    >
                      <span className="text-[16px] font-medium text-foreground">
                        {item.q}
                      </span>
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-muted-foreground">
                        {isOpen ? (
                          <Minus size={15} strokeWidth={1.75} />
                        ) : (
                          <Plus size={15} strokeWidth={1.75} />
                        )}
                      </span>
                    </button>
                    <div
                      className={`grid transition-all duration-300 ease-out ${
                        isOpen
                          ? "grid-rows-[1fr] opacity-100"
                          : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        <p className="max-w-[60ch] pb-5 text-[15px] leading-relaxed text-muted-foreground">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
