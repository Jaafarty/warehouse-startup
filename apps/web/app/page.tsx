import { Space_Grotesk } from "next/font/google";
import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Industries } from "@/components/landing/industries";
import { Features } from "@/components/landing/features";
import { Bento } from "@/components/landing/bento";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Pricing } from "@/components/landing/pricing";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export default function HomePage() {
  return (
    <div className={`${display.variable} bg-background text-foreground`}>
      <Nav />
      <main>
        <Hero />
        <Industries />
        <Features />
        <Bento />
        <HowItWorks />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
