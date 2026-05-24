const GENERIC_FALLBACK = "Something went wrong. Please try again.";

const NOISE_MARKERS = [
  "[CONVEX",
  "Server Error",
  "Uncaught Error",
  "Request ID",
];

function unwrapEmbeddedConvexError(raw: string): string | null {
  const match = raw.match(/ConvexError:\s*(\{[\s\S]*?\})(?:\s|$)/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]) as { message?: unknown };
    if (typeof parsed.message === "string" && parsed.message.length > 0) {
      return parsed.message;
    }
  } catch {
    // fall through
  }
  return null;
}

function looksNoisy(raw: string): boolean {
  return NOISE_MARKERS.some((marker) => raw.includes(marker));
}

/**
 * Pull a user-safe message out of any error thrown by a server action,
 * Convex mutation, or ConvexHttpClient call.
 *
 * Order:
 * 1. ConvexError instance → unwrap `data.message`.
 * 2. Plain Error whose message embeds `ConvexError: {...}` (the format
 *    ConvexHttpClient produces) → regex-unwrap the inner `message`.
 * 3. Plain Error with a clean message → pass through.
 * 4. Anything that looks like raw server noise → fallback (raw is
 *    console.error'd so developers can still see it).
 * 5. Anything else → fallback.
 */
export function friendlyMessage(
  error: unknown,
  fallback: string = GENERIC_FALLBACK,
): string {
  if (error && typeof error === "object") {
    const data = (error as { data?: { message?: unknown } }).data;
    if (data && typeof data.message === "string" && data.message.length > 0) {
      return data.message;
    }

    const rawMsg = (error as { message?: unknown }).message;
    if (typeof rawMsg === "string" && rawMsg.length > 0) {
      const unwrapped = unwrapEmbeddedConvexError(rawMsg);
      if (unwrapped) return unwrapped;

      if (looksNoisy(rawMsg)) {
        if (typeof console !== "undefined") console.error("Raw error:", error);
        return fallback;
      }

      return rawMsg;
    }
  }

  if (typeof error === "string" && error.length > 0) {
    const unwrapped = unwrapEmbeddedConvexError(error);
    if (unwrapped) return unwrapped;
    if (looksNoisy(error)) {
      if (typeof console !== "undefined") console.error("Raw error:", error);
      return fallback;
    }
    return error;
  }

  if (typeof console !== "undefined") console.error("Raw error:", error);
  return fallback;
}
