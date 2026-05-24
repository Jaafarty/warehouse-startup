const GENERIC_FALLBACK = "Something went wrong.";

// Markers that are unique to Convex's ConvexHttpClient wire format. Generic
// substrings like "Server Error" are deliberately NOT included — they appear
// in legitimate non-Convex error messages (Clerk session errors, fetch
// failures, etc.) where we want the original message to reach the user.
const NOISE_MARKERS = ["[CONVEX", "[convex", "Request ID:", "request id:"];

/**
 * Pull the embedded `ConvexError: {...}` payload out of a noisy
 * ConvexHttpClient error message, using balanced-brace scanning so it works
 * even when the inner `message` field contains `}` characters (e.g. product
 * names like "Office } Tech").
 */
function unwrapEmbeddedConvexError(raw: string): string | null {
  const marker = "ConvexError:";
  const markerIdx = raw.indexOf(marker);
  if (markerIdx === -1) return null;

  const start = raw.indexOf("{", markerIdx);
  if (start === -1) return null;

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = start; j < raw.length; j++) {
    const c = raw[j];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (c === "\\") {
        esc = true;
      } else if (c === '"') {
        inStr = false;
      }
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === "{") {
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(raw.slice(start, j + 1)) as {
            message?: unknown;
          };
          if (typeof parsed.message === "string" && parsed.message.length > 0) {
            return parsed.message;
          }
        } catch {
          // fall through
        }
        return null;
      }
    }
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
 *    ConvexHttpClient produces) → balanced-brace unwrap the inner `message`.
 * 3. Plain Error with a clean message → pass through.
 * 4. Anything that looks like raw Convex transport noise → fallback (raw
 *    is console.error'd so developers can still see it).
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
