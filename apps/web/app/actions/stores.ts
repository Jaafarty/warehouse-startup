"use server";

import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { requireCurrentUserId } from "@/lib/auth";
import { redirect } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as any;
    return data?.message ?? fallback;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}

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
    return { success: false, error: extractErrorMessage(error, "Failed to create store") };
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
    return { success: false, error: extractErrorMessage(error, "Failed to update store") };
  }
}

export async function inviteMember(storeId: string, formData: FormData) {
  const userId = await requireCurrentUserId();

  const email = formData.get("email") as string;
  const role = formData.get("role") as "admin" | "employee" | "viewer" | "custom";
  const customRoleId = formData.get("customRoleId") as string | null;

  if (!email) return { success: false, error: "Email is required" };

  try {
    const result = await convex.mutation(api.invitations.create, {
      storeId: storeId as any,
      userId,
      email,
      role: role || "viewer",
      customRoleId: (customRoleId as any) || undefined,
    });
    return { success: true, token: result.token };
  } catch (error) {
    return { success: false, error: extractErrorMessage(error, "Failed to send invitation") };
  }
}

export async function updateMemberRole(
  storeId: string,
  memberId: string,
  newRole: "admin" | "employee" | "viewer" | "custom",
  customRoleId?: string
) {
  const userId = await requireCurrentUserId();

  try {
    await convex.mutation(api.members.updateRole, {
      storeId: storeId as any,
      userId,
      targetMemberId: memberId as any,
      newRole,
      customRoleId: customRoleId as any,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: extractErrorMessage(error, "Failed to update role") };
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
    return { success: false, error: extractErrorMessage(error, "Failed to remove member") };
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
    return { success: false, error: extractErrorMessage(error, "Failed to accept invitation") };
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
    return { success: false, error: extractErrorMessage(error, "Failed to decline invitation") };
  }
}

export async function deleteStore(storeId: string) {
  const userId = await requireCurrentUserId();
  try {
    await convex.mutation(api.stores.deleteStore, {
      storeId: storeId as any,
      userId,
    });
    redirect("/dashboard");
  } catch (error) {
    if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    return { success: false, error: extractErrorMessage(error, "Failed to delete store") };
  }
}
