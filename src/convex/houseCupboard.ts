import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import {
  CUPBOARD_FOOD_ORDER,
  EMPTY_CUPBOARD_INVENTORY,
  isCupboardFoodId,
  type CupboardFoodId,
  type CupboardInventory,
} from "../game/data/houseCupboard";
import { isHouseId, type HouseId } from "../game/data/houses";

type CupboardDoc = Doc<"houseFoodCupboards">;

interface CupboardMember {
  userId: Id<"users">;
  identity: Doc<"playerIdentities">;
  houseId: HouseId;
}

async function requireMember(ctx: QueryCtx | MutationCtx): Promise<CupboardMember> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError("Sign in to use your house cupboard.");
  const identity = await ctx.db
    .query("playerIdentities")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
  if (!identity) throw new ConvexError("Create your NAVODAYA student profile first.");
  if (!isHouseId(identity.houseId)) throw new ConvexError("Your house assignment is invalid.");
  return { userId, identity, houseId: identity.houseId };
}

async function findCupboard(
  ctx: QueryCtx | MutationCtx,
  houseId: HouseId,
): Promise<CupboardDoc | null> {
  return ctx.db
    .query("houseFoodCupboards")
    .withIndex("by_house", (q) => q.eq("houseId", houseId))
    .first();
}

function inventoryOf(cupboard: CupboardDoc | null): CupboardInventory {
  if (!cupboard) return { ...EMPTY_CUPBOARD_INVENTORY };
  return {
    chicken: cupboard.chicken,
    fries: cupboard.fries,
    samosa: cupboard.samosa,
    burger: cupboard.burger,
    coldDrink: cupboard.coldDrink,
  };
}

async function ensureCupboard(
  ctx: MutationCtx,
  houseId: HouseId,
): Promise<CupboardDoc> {
  const existing = await findCupboard(ctx, houseId);
  if (existing) return existing;
  const now = Date.now();
  const id = await ctx.db.insert("houseFoodCupboards", {
    houseId,
    ...EMPTY_CUPBOARD_INVENTORY,
    totalDeposited: 0,
    totalConsumed: 0,
    createdAt: now,
    updatedAt: now,
  });
  const created = await ctx.db.get(id);
  if (!created) throw new ConvexError("The cupboard could not be prepared.");
  return created;
}

async function recentTransactions(ctx: QueryCtx, houseId: HouseId, userId: Id<"users">) {
  const rows = await ctx.db
    .query("houseFoodTransactions")
    .withIndex("by_house_created", (q) => q.eq("houseId", houseId))
    .order("desc")
    .take(16);
  return rows.map((row) => ({
    id: row._id,
    action: row.action,
    item: row.item,
    quantity: row.quantity,
    playerName: row.playerName,
    createdAt: row.createdAt,
    isMine: row.userId === userId,
  }));
}

/**
 * The live shared inventory for the signed-in student's own house. The house
 * is never accepted as an argument, so a modified client cannot ask for
 * another house's cupboard.
 */
export const myCupboard = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const identity = await ctx.db
      .query("playerIdentities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    if (!identity || !isHouseId(identity.houseId)) return null;

    const cupboard = await findCupboard(ctx, identity.houseId);
    const items = inventoryOf(cupboard);
    return {
      houseId: identity.houseId,
      items,
      total: CUPBOARD_FOOD_ORDER.reduce((sum, id) => sum + items[id], 0),
      totalDeposited: cupboard?.totalDeposited ?? 0,
      totalConsumed: cupboard?.totalConsumed ?? 0,
      updatedAt: cupboard?.updatedAt ?? null,
      recent: await recentTransactions(ctx, identity.houseId, userId),
    };
  },
});

/**
 * Deposits the food actually saved on one owned MESS RUN record. Counts are
 * read from the server record, never from this mutation's arguments, and the
 * run is stamped so replaying the same request cannot duplicate food.
 */
export const depositRun = mutation({
  args: { runId: v.id("messRunRuns") },
  handler: async (ctx, args) => {
    const member = await requireMember(ctx);
    const run = await ctx.db.get(args.runId);
    if (!run || run.userId !== member.userId) {
      throw new ConvexError("That MESS RUN record does not belong to you.");
    }
    if (run.pantryDepositedAt) {
      throw new ConvexError("This run's food has already been deposited.");
    }

    const deposited: CupboardInventory = {
      chicken: Math.max(0, Math.floor(run.chicken ?? 0)),
      fries: Math.max(0, Math.floor(run.fries ?? 0)),
      samosa: Math.max(0, Math.floor(run.samosa ?? 0)),
      burger: Math.max(0, Math.floor(run.burger ?? 0)),
      coldDrink: Math.max(0, Math.floor(run.coldDrink ?? 0)),
    };
    const total = CUPBOARD_FOOD_ORDER.reduce((sum, id) => sum + deposited[id], 0);
    if (total <= 0) {
      throw new ConvexError("That run did not collect any food to deposit.");
    }

    const cupboard = await ensureCupboard(ctx, member.houseId);
    const now = Date.now();
    await ctx.db.patch(cupboard._id, {
      chicken: cupboard.chicken + deposited.chicken,
      fries: cupboard.fries + deposited.fries,
      samosa: cupboard.samosa + deposited.samosa,
      burger: cupboard.burger + deposited.burger,
      coldDrink: cupboard.coldDrink + deposited.coldDrink,
      totalDeposited: cupboard.totalDeposited + total,
      updatedAt: now,
    });
    // Stamping the owned run is the duplicate guard. Concurrent requests
    // conflict on this document and the retried transaction sees the stamp.
    await ctx.db.patch(run._id, {
      pantryDepositedAt: now,
      pantryHouseId: member.houseId,
    });

    for (const item of CUPBOARD_FOOD_ORDER) {
      const quantity = deposited[item];
      if (quantity <= 0) continue;
      await ctx.db.insert("houseFoodTransactions", {
        houseId: member.houseId,
        userId: member.userId,
        playerId: member.identity.playerId,
        playerName: member.identity.displayName,
        action: "deposit",
        item,
        quantity,
        sourceRunId: run._id,
        createdAt: now,
      });
    }

    return {
      houseId: member.houseId,
      deposited,
      total,
      items: {
        chicken: cupboard.chicken + deposited.chicken,
        fries: cupboard.fries + deposited.fries,
        samosa: cupboard.samosa + deposited.samosa,
        burger: cupboard.burger + deposited.burger,
        coldDrink: cupboard.coldDrink + deposited.coldDrink,
      },
    };
  },
});

/** Atomically removes one item from the caller's own shared house cupboard. */
export const consumeFood = mutation({
  args: { item: v.string() },
  handler: async (ctx, args) => {
    if (!isCupboardFoodId(args.item)) {
      throw new ConvexError("That food is not kept in the house cupboard.");
    }
    const item: CupboardFoodId = args.item;
    const member = await requireMember(ctx);
    const cupboard = await ensureCupboard(ctx, member.houseId);
    const available = cupboard[item];
    if (available <= 0) {
      throw new ConvexError("That shelf is empty. Another house member may have taken the last one.");
    }

    const remaining = available - 1;
    const now = Date.now();
    await ctx.db.patch(cupboard._id, {
      [item]: remaining,
      totalConsumed: cupboard.totalConsumed + 1,
      updatedAt: now,
    });
    await ctx.db.insert("houseFoodTransactions", {
      houseId: member.houseId,
      userId: member.userId,
      playerId: member.identity.playerId,
      playerName: member.identity.displayName,
      action: "consume",
      item,
      quantity: 1,
      createdAt: now,
    });

    return {
      houseId: member.houseId,
      item,
      remaining,
      total: CUPBOARD_FOOD_ORDER.reduce(
        (sum, id) => sum + (id === item ? remaining : cupboard[id]),
        0,
      ),
    };
  },
});
