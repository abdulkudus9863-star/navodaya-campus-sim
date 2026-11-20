import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  computeMessRunScore,
  isMessRunMode,
  isMessRunTeacherId,
  messRunMode,
} from "../game/messrun/messRunData";

const MAX_RUN_MS = 30 * 60 * 1000;
const MAX_SPEED = 24;
const MAX_STORED_RUNS = 40;

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function validateOutcome(outcome: string): "caught" | "empty" | "delivered" {
  if (outcome === "caught" || outcome === "empty" || outcome === "delivered") return outcome;
  throw new ConvexError("Unknown MESS RUN result.");
}

/**
 * Scores are recalculated from bounded run inputs, never trusted from the
 * client. The checks reject physically impossible distances, collections and
 * delivery claims while allowing slower mobile runs.
 */
export const submitRun = mutation({
  args: {
    teacherId: v.string(),
    mode: v.string(),
    outcome: v.string(),
    distance: v.number(),
    durationMs: v.number(),
    leftTray: v.number(),
    rightTray: v.number(),
    coins: v.number(),
    nearMisses: v.number(),
    obstaclesAvoided: v.number(),
    chicken: v.optional(v.number()),
    fries: v.optional(v.number()),
    samosa: v.optional(v.number()),
    burger: v.optional(v.number()),
    coldDrink: v.optional(v.number()),
    chickenFeasts: v.optional(v.number()),
    boostScore: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to save a MESS RUN result.");

    if (!isMessRunTeacherId(args.teacherId)) throw new ConvexError("Unknown teacher chaser.");
    if (!isMessRunMode(args.mode)) throw new ConvexError("Unknown MESS RUN mode.");
    const mode = messRunMode(args.mode);
    const outcome = validateOutcome(args.outcome);

    const durationMs = clamp(Math.floor(args.durationMs), 500, MAX_RUN_MS);
    const durationSeconds = durationMs / 1000;
    const distance = clamp(Math.floor(args.distance), 0, durationSeconds * MAX_SPEED + 20);
    const leftTray = clamp(Math.floor(args.leftTray), 0, 100);
    const rightTray = clamp(Math.floor(args.rightTray), 0, 100);
    const foodLeft = Math.round((leftTray + rightTray) / 2);
    const coins = clamp(Math.floor(args.coins), 0, durationSeconds * 2 + 8);
    const nearMisses = clamp(Math.floor(args.nearMisses), 0, durationSeconds * 2 + 12);
    const obstaclesAvoided = clamp(
      Math.floor(args.obstaclesAvoided),
      0,
      durationSeconds * 3 + 20,
    );
    const collectibleLimit = Math.floor(durationSeconds * 2 + 20);
    const chicken = clamp(Math.floor(args.chicken ?? 0), 0, collectibleLimit);
    const fries = clamp(Math.floor(args.fries ?? 0), 0, collectibleLimit);
    const samosa = clamp(Math.floor(args.samosa ?? 0), 0, collectibleLimit);
    const burger = clamp(Math.floor(args.burger ?? 0), 0, collectibleLimit);
    const coldDrink = clamp(Math.floor(args.coldDrink ?? 0), 0, collectibleLimit);
    const chickenFeasts = clamp(
      Math.floor(args.chickenFeasts ?? 0),
      0,
      Math.floor(chicken / 5),
    );
    // The temporary burger/feast multiplier only adds score during its active
    // window. Accept a bounded boost that cannot exceed the theoretical extra
    // distance and collectible points those pickups can generate.
    const boostScore = clamp(
      Math.floor(args.boostScore ?? 0),
      0,
      burger * 320 + chickenFeasts * 450,
    );

    if (outcome === "delivered") {
      if (
        mode.targetDistance === null ||
        distance + 2 < mode.targetDistance ||
        foodLeft < mode.minimumFood
      ) {
        throw new ConvexError("That delivery result is not valid for this mode.");
      }
    }

    const score = computeMessRunScore({
      distance,
      foodLeft,
      coins,
      nearMisses,
      mode: mode.id,
      collectibles: { chicken, fries, samosa, burger, coldDrink },
      chickenFeasts,
      boostScore,
    });
    const identity = await ctx.db
      .query("playerIdentities")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const previousBest = await ctx.db
      .query("messRunRuns")
      .withIndex("by_user_score", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const runId = await ctx.db.insert("messRunRuns", {
      userId,
      playerId: identity?.playerId ?? String(userId),
      teacherId: args.teacherId,
      mode: mode.id,
      outcome,
      score,
      distance,
      durationMs,
      foodLeft,
      leftTray,
      rightTray,
      coins,
      nearMisses,
      obstaclesAvoided,
      chicken,
      fries,
      samosa,
      burger,
      coldDrink,
      chickenFeasts,
      boostScore,
      createdAt: Date.now(),
    });

    const stale = await ctx.db
      .query("messRunRuns")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_STORED_RUNS + 10);
    for (const run of stale.slice(MAX_STORED_RUNS)) {
      await ctx.db.delete(run._id);
    }

    return {
      runId,
      score,
      bestScore: Math.max(score, previousBest?.score ?? 0),
      isBest: score > (previousBest?.score ?? 0),
    };
  },
});

/** Account-level best and recent runs for the selection screen. */
export const mySummary = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const best = await ctx.db
      .query("messRunRuns")
      .withIndex("by_user_score", (q) => q.eq("userId", userId))
      .order("desc")
      .first();
    const recent = await ctx.db
      .query("messRunRuns")
      .withIndex("by_user_created", (q) => q.eq("userId", userId))
      .order("desc")
      .take(6);

    return {
      bestScore: best?.score ?? 0,
      bestRun: best
        ? {
            teacherId: best.teacherId,
            mode: best.mode,
            score: best.score,
            distance: best.distance,
            foodLeft: best.foodLeft,
            coins: best.coins,
            durationMs: best.durationMs,
            outcome: best.outcome,
            collectibles: {
              chicken: best.chicken ?? 0,
              fries: best.fries ?? 0,
              samosa: best.samosa ?? 0,
              burger: best.burger ?? 0,
              coldDrink: best.coldDrink ?? 0,
            },
            chickenFeasts: best.chickenFeasts ?? 0,
            at: best.createdAt,
          }
        : null,
      recent: recent.map((run) => ({
        teacherId: run.teacherId,
        mode: run.mode,
        score: run.score,
        distance: run.distance,
        foodLeft: run.foodLeft,
        coins: run.coins,
        durationMs: run.durationMs,
        outcome: run.outcome,
        collectibles: {
          chicken: run.chicken ?? 0,
          fries: run.fries ?? 0,
          samosa: run.samosa ?? 0,
          burger: run.burger ?? 0,
          coldDrink: run.coldDrink ?? 0,
        },
        chickenFeasts: run.chickenFeasts ?? 0,
        at: run.createdAt,
      })),
    };
  },
});
