import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { assertPageFunction } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    email: v.string(),
    role: v.union(
      v.literal("admin"),
      v.literal("employee"),
      v.literal("viewer"),
      v.literal("custom")
    ),
    customRoleId: v.optional(v.id("storeRoles")),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "members", "invite_member");

    // Check if already a member
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", args.email))
      .unique();

    if (existingUser) {
      const existingMember = await ctx.db
        .query("storeMembers")
        .withIndex("by_store_and_user", (q: any) =>
          q.eq("storeId", args.storeId).eq("userId", existingUser._id)
        )
        .unique();

      if (existingMember) {
        throw new ConvexError({ code: "CONFLICT", message: "This person is already a member of this store." });
      }
    }

    // Check for pending invitation
    const existingInvite = await ctx.db
      .query("storeInvitations")
      .withIndex("by_store_and_email", (q: any) =>
        q.eq("storeId", args.storeId).eq("email", args.email)
      )
      .first();

    if (existingInvite && existingInvite.status === "pending") {
      throw new ConvexError({ code: "CONFLICT", message: "An invitation is already pending for this email address." });
    }

    const token =
      Math.random().toString(36).substring(2) +
      Math.random().toString(36).substring(2) +
      Date.now().toString(36);

    const inviteId = await ctx.db.insert("storeInvitations", {
      storeId: args.storeId,
      email: args.email,
      role: args.role,
      customRoleId: args.customRoleId,
      invitedBy: args.userId,
      token,
      status: "pending",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    const store = await ctx.db.get(args.storeId);

    // Create notification if user exists
    if (existingUser) {
      await ctx.db.insert("notifications", {
        userId: existingUser._id,
        storeId: args.storeId,
        type: "store_invitation",
        title: "Store Invitation",
        message: `You've been invited to join "${store?.name ?? "a store"}"`,
        isRead: false,
        metadata: { token, storeId: args.storeId },
        createdAt: Date.now(),
      });
    }

    // Send the invitation email (scheduled because mutations can't do HTTP).
    const inviter = await ctx.db.get(args.userId);
    await ctx.scheduler.runAfter(0, internal.email.sendInviteEmail, {
      to: args.email,
      token,
      storeName: store?.name ?? "a store",
      inviterName: inviter?.name ?? "A teammate",
      role: args.role,
    });

    console.log(`[DEV] Invitation link: /invite/${token}`);

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "invitation.create",
      entityType: "invitation",
      entityId: inviteId,
      details: { email: args.email, role: args.role },
    });

    return { token };
  },
});

export const listByStore = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(ctx.db, args.userId, args.storeId, "members", "view_members");

    return ctx.db
      .query("storeInvitations")
      .withIndex("by_store", (q: any) => q.eq("storeId", args.storeId))
      .collect();
  },
});

export const getByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("storeInvitations")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!invite) return null;

    const store = await ctx.db.get(invite.storeId);
    const inviter = await ctx.db.get(invite.invitedBy);

    return {
      ...invite,
      storeName: store?.name ?? "Unknown",
      inviterName: inviter?.name ?? "Unknown",
    };
  },
});

export const accept = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("storeInvitations")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!invite || invite.status !== "pending") {
      throw new ConvexError({ code: "NOT_FOUND", message: "This invitation link is invalid or has expired." });
    }
    if (Date.now() > invite.expiresAt) {
      await ctx.db.patch(invite._id, { status: "expired" });
      throw new ConvexError({ code: "NOT_FOUND", message: "This invitation link is invalid or has expired." });
    }

    // Check if already a member
    const existing = await ctx.db
      .query("storeMembers")
      .withIndex("by_store_and_user", (q: any) =>
        q.eq("storeId", invite.storeId).eq("userId", args.userId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(invite._id, { status: "accepted" });
      throw new ConvexError({ code: "CONFLICT", message: "This person is already a member of this store." });
    }

    await ctx.db.insert("storeMembers", {
      storeId: invite.storeId,
      userId: args.userId,
      role: invite.role,
      customRoleId: invite.customRoleId,
      joinedAt: Date.now(),
    });

    await ctx.db.patch(invite._id, { status: "accepted" });

    // Notify store admins
    const admins = await ctx.db
      .query("storeMembers")
      .withIndex("by_store", (q: any) => q.eq("storeId", invite.storeId))
      .collect();

    const newUser = await ctx.db.get(args.userId);
    const store = await ctx.db.get(invite.storeId);

    for (const admin of admins.filter((m: any) => m.role === "admin")) {
      await ctx.db.insert("notifications", {
        userId: admin.userId,
        storeId: invite.storeId,
        type: "member_joined",
        title: "New Member",
        message: `${newUser?.name ?? "Someone"} joined "${store?.name ?? "your store"}"`,
        isRead: false,
        createdAt: Date.now(),
      });
    }

    await createAuditLog(ctx.db, {
      storeId: invite.storeId,
      userId: args.userId,
      action: "invitation.accept",
      entityType: "invitation",
      entityId: invite._id,
    });

    return { storeId: invite.storeId };
  },
});

export const decline = mutation({
  args: {
    token: v.string(),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const invite = await ctx.db
      .query("storeInvitations")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .unique();

    if (!invite || invite.status !== "pending") {
      throw new ConvexError({ code: "NOT_FOUND", message: "This invitation link is invalid or has expired." });
    }

    await ctx.db.patch(invite._id, { status: "declined" });

    return { success: true };
  },
});
