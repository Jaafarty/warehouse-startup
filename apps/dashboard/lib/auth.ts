import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Resolves the authenticated Clerk user to the Convex `users._id`, creating
// or updating the user row on first call.
export async function getCurrentUserId(): Promise<Id<"users"> | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  if (!user) return null;

  const email =
    user.primaryEmailAddress?.emailAddress ??
    user.emailAddresses[0]?.emailAddress ??
    "";
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ").trim() ||
    user.username ||
    email ||
    "User";

  return (await convex.mutation(api.users.store, {
    clerkId: userId,
    email,
    name,
    image: user.imageUrl,
  })) as Id<"users">;
}

// Convenience: throws if unauthenticated. Use in server actions.
export async function requireCurrentUserId(): Promise<Id<"users">> {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}
