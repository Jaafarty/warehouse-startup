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
