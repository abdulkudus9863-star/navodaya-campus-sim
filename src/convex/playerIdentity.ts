import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { appearanceValidator } from "./identityValidators";
import {
  ACHIEVEMENT_XP,
  getAchievement,
  levelFromXp,
  maxXpForAchievements,
} from "../game/data/achievements";
import { getHouse } from "../game/data/houses";
import { getStudent, validateCharacterSelection } from "../game/data/students";

const MAX_PLAYER_ID = 80;

type Reader = QueryCtx | MutationCtx;

function createPlayerId(): string {
  return `navodaya-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePlayerId(raw: string): string {
  const value = raw.trim();
  if (/^[A-Za-z0-9_-]{4,80}$/.test(value)) return value;
  return createPlayerId();
}

function publicIdentity(identity: Doc<"playerIdentities">) {
  return {
    _id: identity._id,
    playerId: identity.playerId,
    characterId: identity.characterId,
    houseId: identity.houseId,
    displayName: identity.displayName,
    className: identity.className,
    section: identity.section,
    roomNumber: identity.roomNumber,
    appearance: identity.appearance,
    xp: identity.xp,
    level: levelFromXp(identity.xp),
    achievements: identity.achievements,
    xpHistory: identity.xpHistory,
    createdAt: identity.createdAt,
    updatedAt: identity.updatedAt,
  };
}

async function identityForUser(ctx: Reader, userId: Id<"users">) {
  return await ctx.db
    .query("playerIdentities")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .unique();
}

async function playerIdAvailable(
  ctx: Reader,
  playerId: string,
  userId: Id<"users">,
): Promise<boolean> {
  const existing = await ctx.db
    .query("playerIdentities")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .unique();
  return !existing || existing.userId === userId;
}

/**
 * Returns the signed-in player's account identity. It deliberately omits the
 * auth user ID and any account contact details.
 */
export const myIdentity = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const identity = await identityForUser(ctx, userId);
    return identity ? publicIdentity(identity) : null;
  },
});

/**
 * Claims an account identity once, using the player's existing local profile.
 * The roster/house pair is validated on the server and can never be changed by
 * a later claim, so an account cannot be reassigned by the client.
 */
export const claim = mutation({
  args: {
    playerId: v.string(),
    characterId: v.string(),
    houseId: v.string(),
    appearance: appearanceValidator,
    achievements: v.array(v.string()),
    xp: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to claim a player identity.");

    const existing = await identityForUser(ctx, userId);
    if (existing) return publicIdentity(existing);

    const validation = validateCharacterSelection(args.characterId, args.houseId);
    if (!validation.ok) throw new ConvexError(validation.error);
    const student = getStudent(args.characterId);
    const house = getHouse(args.houseId);
    if (!student || !house) throw new ConvexError("That campus identity is not registered.");

    const validAchievements = Array.from(
      new Set(
        args.achievements
          .filter((id): id is string => typeof id === "string" && Boolean(getAchievement(id)))
          .slice(0, 50),
      ),
    );
    if (!validAchievements.includes("house-colours")) validAchievements.unshift("house-colours");

    const now = Date.now();
    const maxXp = maxXpForAchievements(validAchievements);
    const xp = Math.min(maxXp, Math.max(0, Math.floor(args.xp)));

    let playerId = normalizePlayerId(args.playerId);
    if (!(await playerIdAvailable(ctx, playerId, userId))) playerId = createPlayerId();
    if (playerId.length > MAX_PLAYER_ID) playerId = createPlayerId();

    const identityId = await ctx.db.insert("playerIdentities", {
      userId,
      playerId,
      characterId: student.id,
      houseId: house.id,
      displayName: student.displayName,
      className: student.className,
      section: student.section,
      roomNumber: null,
      appearance: args.appearance,
      xp,
      achievements: validAchievements.map((id) => ({ id, unlockedAt: now })),
      xpHistory:
        xp > 0
          ? [
              {
                kind: "imported",
                label: "Existing campus progress",
                xp,
                at: now,
              },
            ]
          : [],
      createdAt: now,
      updatedAt: now,
    });

    const identity = await ctx.db.get(identityId);
    if (!identity) throw new ConvexError("The player identity could not be created.");
    return publicIdentity(identity);
  },
});

/** Appearance is the only mutable part of an identity. House and student stay locked. */
export const saveAppearance = mutation({
  args: { appearance: appearanceValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError("Sign in to update your appearance.");
    const identity = await identityForUser(ctx, userId);
    if (!identity) throw new ConvexError("Claim your player identity before customizing it.");

    await ctx.db.patch(identity._id, {
      appearance: args.appearance,
      updatedAt: Date.now(),
    });
    const updated = await ctx.db.get(identity._id);
    if (!updated) throw new ConvexError("The player identity could not be updated.");
    return publicIdentity(updated);
  },
});

/**
 * Records one of the game's existing achievement events. XP amounts come from
 * the server's canonical achievement table, never from the client, and an
 * achievement can only grant XP once per identity.
 */
export const recordAchievement = mutation({
  args: { achievementId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const identity = await identityForUser(ctx, userId);
    if (!identity) return null;

    const achievement = getAchievement(args.achievementId);
    if (!achievement) throw new ConvexError("Unknown campus achievement.");

    if (identity.achievements.some((entry) => entry.id === achievement.id)) {
      return {
        identity: publicIdentity(identity),
        unlocked: false,
        xpAwarded: 0,
        leveledUp: false,
      };
    }

    const now = Date.now();
    const xpAwarded = Math.max(0, ACHIEVEMENT_XP[achievement.id] ?? 0);
    const previousLevel = levelFromXp(identity.xp);
    const nextXp = identity.xp + xpAwarded;
    const nextLevel = levelFromXp(nextXp);
    const xpHistory = [
      ...identity.xpHistory,
      {
        kind: `achievement:${achievement.id}`,
        label: achievement.name,
        xp: xpAwarded,
        at: now,
      },
    ].slice(-40);

    await ctx.db.patch(identity._id, {
      xp: nextXp,
      achievements: [
        ...identity.achievements,
        { id: achievement.id, unlockedAt: now },
      ],
      xpHistory,
      updatedAt: now,
    });

    const updated = await ctx.db.get(identity._id);
    if (!updated) throw new ConvexError("The achievement could not be recorded.");
    return {
      identity: publicIdentity(updated),
      unlocked: true,
      xpAwarded,
      leveledUp: nextLevel > previousLevel,
    };
  },
});

