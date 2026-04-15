"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function createStore(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || undefined;

  if (!name || name.trim().length < 2) {
    return { success: false, error: "Store name must be at least 2 characters" };
  }

  try {
    const storeId = await convex.mutation(api.stores.create, {
      userId: session.user.id as any,
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

export async function updateStore(
  storeId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const name = (formData.get("name") as string) || undefined;
  const description = (formData.get("description") as string) || undefined;

  try {
    await convex.mutation(api.stores.update, {
      storeId: storeId as any,
      userId: session.user.id as any,
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

export async function inviteMember(
  storeId: string,
  formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const email = formData.get("email") as string;
  const role = formData.get("role") as "admin" | "editor" | "viewer";

  if (!email) return { success: false, error: "Email is required" };

  try {
    const result = await convex.mutation(api.invitations.create, {
      storeId: storeId as any,
      userId: session.user.id as any,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    await convex.mutation(api.members.updateRole, {
      storeId: storeId as any,
      userId: session.user.id as any,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    await convex.mutation(api.members.remove, {
      storeId: storeId as any,
      userId: session.user.id as any,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    const result = await convex.mutation(api.invitations.accept, {
      token,
      userId: session.user.id as any,
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
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  try {
    await convex.mutation(api.invitations.decline, {
      token,
      userId: session.user.id as any,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to decline invitation",
    };
  }
}
