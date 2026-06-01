import { v } from "convex/values";
import { internalAction } from "./_generated/server";

// Sends a store invitation email via Resend.
// Env vars (set on the Convex deployment via `npx convex env set ...`):
//   RESEND_API_KEY  — Resend API key
//   RESEND_FROM     — verified sender, e.g. "Ware-House <noreply@yourdomain.com>"
//                     (or "onboarding@resend.dev" while testing)
//   SITE_URL        — public origin, e.g. "http://localhost:3000" in dev
export const sendInviteEmail = internalAction({
  args: {
    to: v.string(),
    token: v.string(),
    storeName: v.string(),
    inviterName: v.string(),
    role: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM;
    const siteUrl = process.env.SITE_URL;

    if (!apiKey || !from || !siteUrl) {
      console.warn(
        "[email] RESEND_API_KEY / RESEND_FROM / SITE_URL not set — skipping invite email for",
        args.to,
      );
      return { sent: false, reason: "missing-config" };
    }

    const inviteUrl = `${siteUrl.replace(/\/$/, "")}/invite/${args.token}`;

    const subject = `You're invited to join ${args.storeName} on Ware-House`;
    const text = `${args.inviterName} invited you to join "${args.storeName}" as ${args.role}.\n\nAccept the invitation:\n${inviteUrl}\n\nThis link expires in 7 days.`;
    const html = `
<!doctype html>
<html>
  <body style="font-family: system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
    <h2 style="margin: 0 0 16px;">You're invited to Ware-House</h2>
    <p><strong>${escapeHtml(args.inviterName)}</strong> invited you to join
      <strong>${escapeHtml(args.storeName)}</strong> as
      <strong>${escapeHtml(args.role)}</strong>.</p>
    <p style="margin: 24px 0;">
      <a href="${inviteUrl}"
         style="display:inline-block; background:#111; color:#fff; padding:10px 18px; border-radius:8px; text-decoration:none;">
        Accept invitation
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">
      Or paste this link into your browser:<br/>
      <span style="word-break: break-all;">${inviteUrl}</span>
    </p>
    <p style="font-size: 12px; color: #666;">This link expires in 7 days.</p>
  </body>
</html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject,
        text,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      // 403 with validation_error = Resend sandbox restriction
      // (can only send to the account owner's email until a domain is verified).
      // Treat as a soft failure so the invite row still exists and the admin
      // can copy the link from the UI; don't surface as a backend error.
      if (res.status === 403 && body.includes("validation_error")) {
        console.warn(
          "[email] Resend sandbox: cannot deliver to",
          args.to,
          "— verify a domain at resend.com/domains to enable external recipients.",
        );
        return { sent: false, reason: "sandbox-restricted" };
      }
      console.error("[email] Resend error", res.status, body);
      throw new Error(`Resend request failed: ${res.status} ${body}`);
    }

    return { sent: true };
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
