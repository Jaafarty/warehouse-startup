import { clerkMiddleware } from "@clerk/nextjs/server";

// Marketing site has no protected routes. clerkMiddleware still runs so the
// shared session cookie is read and <SignedIn>/<SignedOut> / useAuth() reflect
// the user's auth state (powering the "Go to Dashboard" toggle).
export default clerkMiddleware();

export const config = {
    matcher: [
        "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
        "/(api|trpc)(.*)",
    ],
};
