"use client";

import { ArrowRight } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Container, Display } from "./ui";
import { dashboardLinks } from "@/lib/links";
import { Reveal } from "./reveal";

export function FinalCta() {
  // Signed-in visitors jump straight to their dashboard; signed-out visitors
  // get the "Start free" sign-up CTA.
  const { isLoaded, isSignedIn } = useAuth();
  const signedIn = isLoaded && isSignedIn;

  return (
    <section className="py-24 md:py-32">
      <Container>
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] bg-primary px-8 py-16 text-center md:py-20">
            <div
              aria-hidden
              className="wh-pattern-grid pointer-events-none absolute inset-0 opacity-[0.12] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_50%,black,transparent)]"
            />
            <div className="relative mx-auto max-w-2xl">
              <Display
                as="h2"
                className="text-3xl text-primary-foreground sm:text-4xl lg:text-5xl"
              >
                Start running your store the right way.
              </Display>
              <p className="mt-4 text-lg text-primary-foreground/80">
                Set up your first store in minutes — no credit card required.
              </p>
              <div className="mt-8 flex justify-center">
                <a
                  href={signedIn ? dashboardLinks.dashboard : dashboardLinks.signUp}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-background px-8 text-[15px] font-semibold text-primary shadow-sm transition-all duration-200 hover:brightness-95 active:translate-y-px focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-background/40"
                >
                  {signedIn ? "Go to your Dashboard" : "Start free"}
                  <ArrowRight size={17} strokeWidth={2} />
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
