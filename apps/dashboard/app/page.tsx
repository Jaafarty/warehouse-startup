import { redirect } from "next/navigation";

// The dashboard app is served on its own subdomain (e.g. dashboard.url.com).
// The marketing landing lives in the separate `apps/landing` app on the root
// domain. Hitting the bare root here goes straight to the dashboard.
export default function RootPage() {
    redirect("/dashboard");
}
