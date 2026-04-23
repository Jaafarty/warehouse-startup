"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createStore(formData: FormData) {
  const userId = await requireCurrentUserId();

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || undefined;

  if (!name || name.trim().length < 2) {
    return { success: false, error: "Store name must be at least 2 characters" };
  }

  try {
    const storeId = await convex.mutation(api.stores.create, {
      userId,
      name: name.trim(),
      description: description?.trim(),
    });
    redirect(`/store/${storeId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create store",
    };
  }
}

export async function updateStore(storeId: string, formData: FormData) {
  const userId = await requireCurrentUserId();

  const name = (formData.get("name") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;

  try {
    await convex.mutation(api.stores.update, {
      storeId: storeId as any,
      userId,
      name: name?.trim(),
      description: description?.trim(),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update store",
    };
  }
}

export async function inviteMember(storeId: string, formData: FormData) {
  const userId = await requireCurrentUserId();

  const email = formData.get("email") as string;
  const role = formData.get("role") as "admin" | "editor" | "viewer";

  if (!email) return { success: false, error: "Email is required" };

  try {
    const result = await convex.mutation(api.invitations.create, {
      storeId: storeId as any,
      userId,
      email,
      role: role || "viewer",
    });
    return { success: true, token: result.token };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send invitation",
    };
  }
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  newRole: "admin" | "editor" | "viewer"
) {
  const userId = await requireCurrentUserId();

  try {
    await convex.mutation(api.members.updateRole, {
      storeId: storeId as any,
      userId,
      targetMemberId: memberId as any,
      newRole,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update role",
    };
  }
}

export async function removeMember(storeId: string, memberId: string) {
  const userId = await requireCurrentUserId();

  try {
    await convex.mutation(api.members.remove, {
      storeId: storeId as any,
      userId,
      targetMemberId: memberId as any,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to remove member",
    };
  }
}

export async function acceptInvitation(token: string) {
  const userId = await requireCurrentUserId();

  try {
    const result = await convex.mutation(api.invitations.accept, {
      token,
      userId,
    });
    redirect(`/store/${result.storeId}`);
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept invitation",
    };
  }
}

export async function declineInvitation(token: string) {
  const userId = await requireCurrentUserId();

  try {
    await convex.mutation(api.invitations.decline, {
      token,
      userId,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to decline invitation",
    };
  }
}
