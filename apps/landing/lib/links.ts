// Cross-app links to the dashboard application. The marketing site lives on the
// root domain (e.g. https://url.com); the authed app lives on a subdomain
// (e.g. https://dashboard.url.com). Auth + dashboard routes therefore point at
// the dashboard origin, not at relative paths on the landing site.
const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

export const dashboardLinks = {
  dashboard: `${DASHBOARD_URL}/dashboard`,
  signIn: `${DASHBOARD_URL}/auth/sign-in`,
  signUp: `${DASHBOARD_URL}/auth/sign-up`,
};

// Cross-origin links (the dashboard subdomain) must be plain <a> anchors so the
// browser performs a real navigation to the other origin. next/link is for
// internal client-side routing only.
export function isExternalLink(href: string) {
  return /^https?:\/\//.test(href);
}
