"use client";

import { ArrowRight } from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import { Container, Display, Eyebrow, PrimaryCTA, SecondaryCTA } from "./ui";
import { dashboardLinks } from "@/lib/links";
import { Stagger, StaggerItem, Reveal, Parallax } from "./reveal";
import { HeroDashboard } from "./previews";

export function Hero() {
  // Signed-in visitors get a single "Dashboard" CTA (no "Start free" / demo);
  // signed-out visitors get the marketing CTAs.
  const { isLoaded, isSignedIn } = useAuth();

  return (
    <section className="relative flex min-h-[100dvh] items-center overflow-hidden pt-24 pb-16">
      {/* subtle backdrop: fading grid + soft teal glow */}
      <div
        aria-hidden
        className="wh-pattern-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,black,transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-0 h-[520px] w-[520px] rounded-full bg-primary/10 blur-[120px]"
      />

      <Container className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <Stagger className="max-w-xl">
          <StaggerItem>
            <Eyebrow>Inventory &amp; sales, in one place</Eyebrow>
          </StaggerItem>
          <StaggerItem>
            <Display
              as="h1"
              className="mt-5 text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
            >
              Run your whole store{" "}
              <span className="text-primary">in one place.</span>
            </Display>
          </StaggerItem>
          <StaggerItem>
            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-muted-foreground">
              Ware-House tracks stock, processes sales and returns, and shows
              real-time analytics — across every location and team.
            </p>
          </StaggerItem>
          <StaggerItem>
            <div className="mt-8 flex min-h-12 flex-col gap-3 sm:flex-row">
              {!isLoaded ? null : isSignedIn ? (
                <PrimaryCTA href={dashboardLinks.dashboard}>
                  Go to Dashboard
                  <ArrowRight size={17} strokeWidth={2} />
                </PrimaryCTA>
              ) : (
                <>
                  <PrimaryCTA href={dashboardLinks.signUp}>
                    Start free
                    <ArrowRight size={17} strokeWidth={2} />
                  </PrimaryCTA>
                  <SecondaryCTA href="#features">Book a demo</SecondaryCTA>
                </>
              )}
            </div>
          </StaggerItem>
        </Stagger>

        <Reveal delay={0.15} y={32}>
          <Parallax amount={28}>
            <HeroDashboard />
          </Parallax>
        </Reveal>
      </Container>
    </section>
  );
}
