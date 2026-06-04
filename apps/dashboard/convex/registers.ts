import { v, ConvexError } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertPageFunction } from "./_helpers/permissions";
import { createAuditLog } from "./_helpers/audit";

/**
 * All registers (active + archived) for the management page, each tagged with
 * whether it currently has an open shift (in use) and who holds it.
 */
export const list = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "registers",
      "view_list"
    );
    const registers = await ctx.db
      .query("registers")
      .withIndex("by_store", (q) => q.eq("storeId", args.storeId))
      .collect();

    return Promise.all(
      registers.map(async (r) => {
        const openShift = await ctx.db
          .query("shifts")
          .withIndex("by_register_and_status", (q) =>
            q.eq("registerId", r._id).eq("status", "open")
          )
          .first();
        let heldByName: string | null = null;
        if (openShift) {
          const u = await ctx.db.get(openShift.openedBy);
          heldByName = u?.name ?? "Unknown";
        }
        return { ...r, inUse: openShift !== null, heldByName };
      })
    );
  },
});

/**
 * Active registers only — used by the open-shift picker. Each entry includes
 * whether it is currently in use (has an open shift) and who holds it, so the
 * picker can show status and disable in-use registers. Gated by open_shift so
 * any cashier who can open a shift can see the registers to choose from.
 */
export const listActive = query({
  args: { storeId: v.id("stores"), userId: v.id("users") },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "shifts",
      "open_shift"
    );
    const registers = await ctx.db
      .query("registers")
      .withIndex("by_store_and_active", (q) =>
        q.eq("storeId", args.storeId).eq("isActive", true)
      )
      .collect();

    return Promise.all(
      registers.map(async (r) => {
        const openShift = await ctx.db
          .query("shifts")
          .withIndex("by_register_and_status", (q) =>
            q.eq("registerId", r._id).eq("status", "open")
          )
          .first();
        let heldByName: string | null = null;
        if (openShift) {
          const u = await ctx.db.get(openShift.openedBy);
          heldByName = u?.name ?? "Unknown";
        }
        return {
          _id: r._id,
          name: r.name,
          inUse: openShift !== null,
          heldByName,
        };
      })
    );
  },
});

export const create = mutation({
  args: {
    storeId: v.id("stores"),
    userId: v.id("users"),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await assertPageFunction(
      ctx.db,
      args.userId,
      args.storeId,
      "registers",
      "create_register"
    );

    const name = args.name.trim();
    if (!name) {
      throw new ConvexError({ code: "INVALID", message: "Name is required." });
    }

    const existing = await ctx.db
      .query("registers")
      .withIndex("by_store_and_name", (q) =>
        q.eq("storeId", args.storeId).eq("name", name)
      )
      .unique();
    if (existing) {
      throw new ConvexError({
        code: "CONFLICT",
        message: "A register with this name already exists.",
      });
    }

    const id = await ctx.db.insert("registers", {
      storeId: args.storeId,
      name,
      isActive: true,
      createdBy: args.userId,
      createdAt: Date.now(),
    });

    await createAuditLog(ctx.db, {
      storeId: args.storeId,
      userId: args.userId,
      action: "register.create",
      entityType: "register",
      entityId: id,
      details: { name },
    });

    return { registerId: id };
  },
});

export const update = mutation({
  args: {
    registerId: v.id("registers"),
    userId: v.id("users"),
    name: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const register = await ctx.db.get(args.registerId);
    if (!register) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Register not found.",
      });
    }

    await assertPageFunction(
      ctx.db,
      args.userId,
      register.storeId,
      "registers",
      "edit_register"
    );

    const patch: { name?: string; isActive?: boolean } = {};

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) {
        throw new ConvexError({
          code: "INVALID",
          message: "Name is required.",
        });
      }
      if (name !== register.name) {
        const dup = await ctx.db
          .query("registers")
          .withIndex("by_store_and_name", (q) =>
            q.eq("storeId", register.storeId).eq("name", name)
          )
          .unique();
        if (dup) {
          throw new ConvexError({
            code: "CONFLICT",
            message: "A register with this name already exists.",
          });
        }
      }
      patch.name = name;
    }

    // Re-activating is always fine. Archiving is blocked while the register
    // has an open shift.
    if (args.isActive !== undefined) {
      if (args.isActive === false && register.isActive) {
        await assertNoOpenShift(ctx.db, args.registerId);
      }
      patch.isActive = args.isActive;
    }

    if (Object.keys(patch).length === 0) return { success: true };

    await ctx.db.patch(args.registerId, patch);

    await createAuditLog(ctx.db, {
      storeId: register.storeId,
      userId: args.userId,
      action: "register.update",
      entityType: "register",
      entityId: args.registerId,
      details: patch,
    });

    return { success: true };
  },
});

/** Archive a register (soft-delete). Blocked while it has an open shift. */
export const remove = mutation({
  args: {
    registerId: v.id("registers"),
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const register = await ctx.db.get(args.registerId);
    if (!register) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Register not found.",
      });
    }

    await assertPageFunction(
      ctx.db,
      args.userId,
      register.storeId,
      "registers",
      "remove_register"
    );

    await assertNoOpenShift(ctx.db, args.registerId);

    await ctx.db.patch(args.registerId, { isActive: false });

    await createAuditLog(ctx.db, {
      storeId: register.storeId,
      userId: args.userId,
      action: "register.archive",
      entityType: "register",
      entityId: args.registerId,
      details: { name: register.name },
    });

    return { success: true };
  },
});

/** Throws CONFLICT if the register currently holds an open shift. */
async function assertNoOpenShift(
  db: import("./_generated/server").DatabaseReader,
  registerId: import("./_generated/dataModel").Id<"registers">
) {
  const open = await db
    .query("shifts")
    .withIndex("by_register_and_status", (q) =>
      q.eq("registerId", registerId).eq("status", "open")
    )
    .first();
  if (open) {
    throw new ConvexError({
      code: "CONFLICT",
      message: "This register has an open shift. Close it before archiving.",
    });
  }
}
