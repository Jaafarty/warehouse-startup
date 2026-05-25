import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentUserId } from "@/lib/auth";
import ConvexErrorBoundary from "@/components/error-boundary";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { userId } = await auth();
    if (!userId) {
        redirect("/auth/sign-in");
    }

    // Ensure a Convex users row exists for this Clerk identity so that
    // subsequent client queries (useCurrentUser) return a user immediately.
    await getCurrentUserId();

    const user = await currentUser();
    const name =
        [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
        user?.username ||
        "User";
    const email =
        user?.primaryEmailAddress?.emailAddress ??
        user?.emailAddresses[0]?.emailAddress ??
        "";

    return (
        <div className="min-h-screen flex flex-col">
            <Topbar userName={name} userEmail={email} />
            <main className="flex-1">
          <ConvexErrorBoundary>{children}</ConvexErrorBoundary>
        </main>
        </div>
    );
}
