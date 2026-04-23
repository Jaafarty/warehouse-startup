"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type AuthResult = {
  success: boolean;
  error?: string;
};

// Updates the user's display name in Convex. Email and password are managed
// by Clerk; point users at the Clerk user profile for those.
export async function updateProfile(formData: FormData): Promise<AuthResult> {
  let userId;
  try {
    userId = await requireCurrentUserId();
  } catch {
    return { success: false, error: "Unauthorized" };
  }

  const name = formData.get("name") as string;
  if (!name || name.trim().length < 1) {
    return { success: false, error: "Name is required" };
  }

  try {
    await convex.mutation(api.users.updateProfile, {
      userId,
      name: name.trim(),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}
