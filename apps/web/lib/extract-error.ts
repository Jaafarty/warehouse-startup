export function friendlyMessage(error: unknown, fallback = "Something went wrong."): string {
  if (error && typeof error === "object") {
    // ConvexError: { data: { message: string } }
    const data = (error as any).data;
    if (data?.message && typeof data.message === "string") return data.message;
    // Plain Error
    const msg = (error as any).message;
    if (msg && typeof msg === "string") return msg;
  }
  return fallback;
}
