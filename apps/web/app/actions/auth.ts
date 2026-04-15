"use server";

import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { signupSchema, loginSchema } from "@ware-house/shared";
import { hashPassword } from "@/lib/auth-utils";
import { signIn } from "@/auth";
import { redirect } from "next/navigation";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type AuthResult = {
  success: boolean;
  error?: string;
};

export async function signup(formData: FormData): Promise<AuthResult> {
  const raw = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }

  const { name, email, password } = parsed.data;

  try {
    const passwordHash = await hashPassword(password);

    await convex.mutation(api.users.create, {
      email,
      name,
      passwordHash,
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Something went wrong";
    return { success: false, error: message };
  }
}

export async function login(formData: FormData): Promise<AuthResult> {
  const raw = {
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.errors[0]?.message ?? "Invalid input",
    };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
  } catch (error) {
    // AuthJS throws specific errors for failed auth
    if (error instanceof Error) {
      if (error.message.includes("CredentialsSignin")) {
        return {
          success: false,
          error: "Invalid email or password. Make sure your email is verified.",
        };
      }
    }
    return { success: false, error: "Something went wrong" };
  }

  redirect("/dashboard");
}

export async function updateProfile(formData: FormData): Promise<AuthResult> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const name = formData.get("name") as string;
  if (!name || name.trim().length < 1) {
    return { success: false, error: "Name is required" };
  }

  try {
    await convex.mutation(api.users.updateProfile, {
      userId: session.user.id as any,
      name: name.trim(),
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update profile",
    };
  }
}

export async function changePassword(formData: FormData): Promise<AuthResult> {
  const { auth } = await import("@/auth");
  const session = await auth();
  if (!session?.user?.id) return { success: false, error: "Unauthorized" };

  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!currentPassword || !newPassword) {
    return { success: false, error: "Both passwords are required" };
  }
  if (newPassword.length < 8) {
    return { success: false, error: "New password must be at least 8 characters" };
  }

  try {
    // Verify current password
    const { verifyPassword } = await import("@/lib/auth-utils");
    const user = await convex.query(api.users.getById, {
      userId: session.user.id as any,
    });
    if (!user) return { success: false, error: "User not found" };

    const isValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return { success: false, error: "Current password is incorrect" };
    }

    const newHash = await hashPassword(newPassword);
    await convex.mutation(api.users.updatePassword, {
      userId: session.user.id as any,
      newPasswordHash: newHash,
    });
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to change password",
    };
  }
}

export async function verifyEmail(token: string): Promise<AuthResult> {
  try {
    await convex.mutation(api.users.verifyEmail, { token });
    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Verification failed";
    return { success: false, error: message };
  }
}
