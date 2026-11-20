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
    });

    const previousBest = await ctx.db
      .query("messRunRuns")
      .withIndex("by_user_score", (q) => q.eq("userId", userId))
      .order("desc")
      .first();

    const runId = await ctx.db.insert("messRunRuns", {
      userId,
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
        at: run.createdAt,
      })),
    };
  },
});
