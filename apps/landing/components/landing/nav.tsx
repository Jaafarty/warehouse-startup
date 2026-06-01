"use client";

import { useEffect, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Boxes, Menu, X } from "lucide-react";
import { Container, PrimaryCTA } from "./ui";
import { dashboardLinks } from "@/lib/links";

const LINKS = [
    { label: "Features", href: "#features" },
    { label: "Analytics", href: "#analytics" },
    { label: "Pricing", href: "#pricing" },
    { label: "FAQ", href: "#faq" },
];

export function Nav() {
    const [scrolled, setScrolled] = useState(false);
    const [open, setOpen] = useState(false);
    // Keep the nav in sync with auth: signed-in visitors get a Dashboard link
    // (no "Sign in" / "Start free"); signed-out visitors get the marketing CTAs.
    const { isLoaded, isSignedIn } = useAuth();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    // Fixed header is h-16 (64px); offset a touch more so the target
    // section heading isn't tucked under the bar.
    const NAV_OFFSET = 72;

    // Smooth-scroll to an in-page section instead of the browser's instant jump.
    const handleNavClick = (e: MouseEvent<HTMLAnchorElement>, href: string) => {
        const el = document.getElementById(href.slice(1)); // "#features" -> "features"
        if (!el) return; // no target on this page: let the link behave normally
        e.preventDefault();
        setOpen(false); // close the mobile menu if it's open
        const y = el.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
        window.scrollTo({ top: y, behavior: "smooth" });
        history.replaceState(null, "", href); // keep the URL hash in sync
    };

    // Clicking the logo glides back to the top (no route reload) while on the landing page.
    const handleLogoClick = (e: MouseEvent<HTMLAnchorElement>) => {
        if (window.location.pathname !== "/") return; // elsewhere: let it navigate home
        e.preventDefault();
        setOpen(false);
        window.scrollTo({ top: 0, behavior: "smooth" });
        history.replaceState(null, "", "/");
    };

    return (
        <header
            className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ease-in-out ${
                scrolled
                    ? "border-b border-border bg-background/80 backdrop-blur-md"
                    : "border-b border-transparent"
            }`}
        >
            <Container className="flex h-16 items-center justify-between">
                <Link
                    href="/"
                    onClick={handleLogoClick}
                    className="flex items-center gap-2 font-[family-name:var(--font-display)] text-[17px] font-bold tracking-tight text-foreground"
                >
                    <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary text-primary-foreground">
                        <Boxes size={18} strokeWidth={1.75} />
                    </span>
                    Ware-House
                </Link>

                <nav className="hidden items-center gap-8 md:flex">
                    {LINKS.map((l) => (
                        <a
                            key={l.href}
                            href={l.href}
                            onClick={(e) => handleNavClick(e, l.href)}
                            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                        >
                            {l.label}
                        </a>
                    ))}
                </nav>

                <div className="hidden items-center gap-3 md:flex">
                    {!isLoaded ? null : isSignedIn ? (
                        <PrimaryCTA
                            href={dashboardLinks.dashboard}
                            className="h-10 px-5 text-sm"
                        >
                            Dashboard
                        </PrimaryCTA>
                    ) : (
                        <>
                            <Link
                                href={dashboardLinks.signIn}
                                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                            >
                                Sign in
                            </Link>
                            <PrimaryCTA
                                href={dashboardLinks.signUp}
                                className="h-10 px-5 text-sm"
                            >
                                Start free
                            </PrimaryCTA>
                        </>
                    )}
                </div>

                <button
                    type="button"
                    aria-label={open ? "Close menu" : "Open menu"}
                    onClick={() => setOpen((v) => !v)}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground md:hidden"
                >
                    {open ? (
                        <X size={18} strokeWidth={1.75} />
                    ) : (
                        <Menu size={18} strokeWidth={1.75} />
                    )}
                </button>
            </Container>

            {open && (
                <div className="border-t border-border bg-background md:hidden">
                    <Container className="flex flex-col gap-1 py-4">
                        {LINKS.map((l) => (
                            <a
                                key={l.href}
                                href={l.href}
                                onClick={(e) => handleNavClick(e, l.href)}
                                className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                            >
                                {l.label}
                            </a>
                        ))}
                        <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                            {!isLoaded ? null : isSignedIn ? (
                                <PrimaryCTA href={dashboardLinks.dashboard} className="h-11">
                                    Dashboard
                                </PrimaryCTA>
                            ) : (
                                <>
                                    <Link
                                        href={dashboardLinks.signIn}
                                        className="rounded-xl px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                                    >
                                        Sign in
                                    </Link>
                                    <PrimaryCTA href={dashboardLinks.signUp} className="h-11">
                                        Start free
                                    </PrimaryCTA>
                                </>
                            )}
                        </div>
                    </Container>
                </div>
            )}
        </header>
    );
}
