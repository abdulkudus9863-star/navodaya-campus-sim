import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";
import {
  achievementRecordValidator,
  appearanceValidator,
  xpHistoryValidator,
} from "./identityValidators";

// default user roles. can add / remove based on the project as needed
export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    // default auth tables using convex auth.
    ...authTables, // do not remove or modify

    // the users table is the default users table that is brought in by the authTables
    users: defineTable({
      name: v.optional(v.string()), // name of the user. do not remove
      image: v.optional(v.string()), // image of the user. do not remove
      email: v.optional(v.string()), // email of the user. do not remove
      emailVerificationTime: v.optional(v.number()), // email verification time. do not remove
      isAnonymous: v.optional(v.boolean()), // is the user anonymous. do not remove

      role: v.optional(roleValidator), // role of the user. do not remove
    }).index("email", ["email"]), // index for the email. do not remove or modify

    // ---------------------------------------------------------------- identity

    /**
     * The account-level identity. One record per authenticated user, created
     * from the existing local player save exactly once. The house/student pair
     * is immutable here and is validated against the game's canonical roster.
     */
    playerIdentities: defineTable({
      userId: v.id("users"),
      playerId: v.string(),
      characterId: v.string(),
      houseId: v.string(),
      displayName: v.string(),
      className: v.string(),
      section: v.union(v.string(), v.null()),
      roomNumber: v.union(v.string(), v.null()),
      appearance: appearanceValidator,
      xp: v.number(),
      achievements: v.array(achievementRecordValidator),
      xpHistory: v.array(xpHistoryValidator),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_player", ["playerId"]),

    // ---------------------------------------------------------------- mess run

    /** Validated run records for the campus endless-runner mini-game. */
    messRunRuns: defineTable({
      userId: v.id("users"),
      playerId: v.string(),
      teacherId: v.string(),
      mode: v.string(),
      outcome: v.union(v.literal("caught"), v.literal("empty"), v.literal("delivered")),
      score: v.number(),
      distance: v.number(),
      durationMs: v.number(),
      foodLeft: v.number(),
      leftTray: v.number(),
      rightTray: v.number(),
      coins: v.number(),
      nearMisses: v.number(),
      obstaclesAvoided: v.number(),
      createdAt: v.number(),
    })
      .index("by_user", ["userId"])
      .index("by_user_score", ["userId", "score"])
      .index("by_user_created", ["userId", "createdAt"]),

    // ---------------------------------------------------------------- multiplayer

    /** One live room per host. Codes are only readable through member-guarded queries. */
    multiplayerRooms: defineTable({
      code: v.string(),
      hostId: v.id("users"),
      status: v.union(
        v.literal("waiting"),
        v.literal("in_mission"),
        v.literal("completed"),
        v.literal("closed"),
      ),
      createdAt: v.number(),
      lastActiveAt: v.number(),
      missionStartedAt: v.optional(v.number()),
      missionEndsAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      missionSuccess: v.optional(v.boolean()),
      collected: v.optional(
        v.array(
          v.object({
            itemId: v.string(),
            userId: v.string(),
            name: v.string(),
            at: v.number(),
          }),
        ),
      ),
    })
      .index("by_code", ["code"])
      .index("by_status", ["status"])
      .index("by_host", ["hostId"]),

    /** Membership doubles as ephemeral presence. Positions are overwritten, not logged. */
    multiplayerMembers: defineTable({
      roomId: v.id("multiplayerRooms"),
      userId: v.id("users"),
      name: v.string(),
      houseId: v.string(),
      characterId: v.string(),
      ready: v.boolean(),
      joinedAt: v.number(),
      lastSeen: v.number(),
      x: v.number(),
      y: v.number(),
      z: v.number(),
      rotationY: v.number(),
      moving: v.boolean(),
      crouching: v.boolean(),
      anim: v.union(
        v.literal("idle"),
        v.literal("walk"),
        v.literal("run"),
        v.literal("jump"),
        v.literal("crouch"),
      ),
      contributions: v.number(),
      rewardGranted: v.boolean(),
    })
      .index("by_room", ["roomId", "joinedAt"])
      .index("by_room_user", ["roomId", "userId"])
      .index("by_user", ["userId"]),

    multiplayerMessages: defineTable({
      roomId: v.id("multiplayerRooms"),
      userId: v.id("users"),
      name: v.string(),
      houseId: v.string(),
      text: v.string(),
      createdAt: v.number(),
    }).index("by_room_created", ["roomId", "createdAt"]),

    multiplayerReports: defineTable({
      roomId: v.id("multiplayerRooms"),
      messageId: v.id("multiplayerMessages"),
      reporterId: v.id("users"),
      reason: v.string(),
      createdAt: v.number(),
    })
      .index("by_room", ["roomId"])
      .index("by_message_reporter", ["messageId", "reporterId"]),

    /** Personal multiplayer rewards. Never touches house points or the local save. */
    multiplayerProgress: defineTable({
      userId: v.id("users"),
      xp: v.number(),
      vegetables: v.number(),
      missions: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // tableName: defineTable({
    //   ...
    //   // table fields
    // }).index("by_field", ["field"])
  },
  {
    schemaValidation: false,
  },
);

export default schema;
