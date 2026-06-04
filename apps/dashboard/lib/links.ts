// The public marketing site lives on a separate origin (e.g. the root domain
// https://n8n-jaafarty.work) while this dashboard runs on a subdomain. Sign-out
// sends the user back to the landing site, so it must be an absolute URL, not a
// relative path on the dashboard origin.
export const landingUrl =
  process.env.NEXT_PUBLIC_LANDING_URL ?? "http://localhost:3001";
