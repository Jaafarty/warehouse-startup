import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Upsert a user record for the currently authenticated Clerk identity.
// Server actions call this (with the Clerk identity already verified) to
// obtain the Convex `users._id` used throughout the app.
export const store = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      const patch: Record<string, string | undefined> = {};
      if (existing.email !== args.email) patch.email = args.email;
      if (existing.name !== args.name) patch.name = args.name;
      if (existing.image !== args.image) patch.image = args.image;
      if (Object.keys(patch).length > 0) {
        await ctx.db.patch(existing._id, patch);
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      image: args.image,
    });
  },
});

// Returns the Convex user document matching the current Clerk identity,
// or null when unauthenticated.
export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
      .unique();
  },
});

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("users")
      .withIndex("by_clerkId", (q: any) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const getById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db.get(args.userId);
  },
});

export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    const patch: Record<string, string | undefined> = {};
    if (updates.name !== undefined) patch.name = updates.name;
    if (updates.image !== undefined) patch.image = updates.image;

    await ctx.db.patch(userId, patch);
    return { success: true };
  },
});
