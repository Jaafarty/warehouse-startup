"use client";

import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// Client hook returning the Convex user row for the signed-in Clerk user.
// `user` is undefined while loading, null if unauthenticated, or the doc.
export function useCurrentUser() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const user = useQuery(api.users.current, isAuthenticated ? {} : "skip");

  return {
    user: isAuthenticated ? user : null,
    userId: (user?._id ?? null) as Id<"users"> | null,
    isLoading: isLoading || (isAuthenticated && user === undefined),
    isAuthenticated,
  };
}
