import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";

/**
 * Operation Midnight Mischief — cooperative multiplayer backend.
 *
 * Security model
 * - Every read/write is authenticated with the Convex Auth user id.
 * - Room details, messages and positions are only returned to room members.
 * - Room state, collectibles, completion and rewards are decided here, not in
 *   the browser. Movement is stored as overwritten presence, never a log.
 * - No email address, auth session or local save is ever returned to peers.
 */

const MAX_PLAYERS = 4;
const MISSION_DURATION_MS = 6 * 60 * 1000;
const MISSION_VEGETABLE_COUNT = 10;
const COLLECT_RADIUS = 3.2;
const SAFE_ZONE = { x: -38, z: 31.8, radius: 3.4 };
const ONLINE_MS = 22_000;
const STALE_MEMBER_MS = 75_000;
const ROOM_IDLE_MS = 30 * 60 * 1000;
const ROOM_IDLE_MISSION_MS = 20 * 60 * 1000;
const CHAT_WINDOW_MS = 15_000;
const CHAT_MAX_IN_WINDOW = 6;
const CHAT_MAX_LENGTH = 240;
const WORLD_BOUNDS = 54;

const HOUSES = ["aravali", "nilgiri", "shivalik", "udaygiri"] as const;

/**
 * Shared collectible layout. Keep in sync with src/game/data/multiplayer.ts.
 * The server uses these positions to reject collection requests from players
 * who are not actually near the crate.
 */
const VEGETABLES: ReadonlyArray<{ id: string; name: string; x: number; z: number }> = [
  { id: "veg-1", name: "Tomato crate", x: -41.8, z: 23.4 },
  { id: "veg-2", name: "Potato crate", x: -40.9, z: 25.6 },
  { id: "veg-3", name: "Carrot crate", x: -39.6, z: 23.0 },
  { id: "veg-4", name: "Cabbage crate", x: -38.2, z: 24.2 },
  { id: "veg-5", name: "Pumpkin crate", x: -36.9, z: 22.8 },
  { id: "veg-6", name: "Bean crate", x: -35.2, z: 24.3 },
  { id: "veg-7", name: "Radish crate", x: -42.1, z: 27.4 },
  { id: "veg-8", name: "Spinach crate", x: -39.5, z: 28.0 },
  { id: "veg-9", name: "Pea crate", x: -36.6, z: 27.6 },
  { id: "veg-10", name: "Chilli crate", x: -34.2, z: 26.4 },
];

const VEGETABLE_IDS = new Set(VEGETABLES.map((item) => item.id));

// ------------------------------------------------------------------ helpers

function cleanName(raw: string): string {
  const stripped = raw
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 24) || "Student";
}

function cleanText(raw: string): string {
  const stripped = raw
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, CHAT_MAX_LENGTH);
}

function isHouse(value: string): boolean {
  return (HOUSES as readonly string[]).includes(value);
}

function cleanCharacterId(value: string): string {
  return /^[A-Z]{3}-\d{3}$/.test(value) ? value : "ARV-001";
}

function clampNumber(value: number, limit: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-limit, Math.min(limit, value));
}

function makeCode(): string {
  // Avoid 0/O/1/I so a code can be read aloud over a hostel corridor.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<"users">> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error("Sign in to use multiplayer.");
  return userId;
}

async function findMembership(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"multiplayerRooms">,
  userId: Id<"users">,
): Promise<Doc<"multiplayerMembers"> | null> {
  return await ctx.db
    .query("multiplayerMembers")
    .withIndex("by_room_user", (q) => q.eq("roomId", roomId).eq("userId", userId))
    .first();
}

async function requireMembership(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"multiplayerRooms">,
  userId: Id<"users">,
): Promise<{ room: Doc<"multiplayerRooms">; member: Doc<"multiplayerMembers"> }> {
  const room = await ctx.db.get(roomId);
  if (!room || room.status === "closed") throw new Error("That room is no longer available.");
  const member = await findMembership(ctx, roomId, userId);
  if (!member) throw new Error("You are not a member of this room.");
  return { room, member };
}

async function roomMembers(
  ctx: QueryCtx | MutationCtx,
  roomId: Id<"multiplayerRooms">,
): Promise<Doc<"multiplayerMembers">[]> {
  return await ctx.db
    .query("multiplayerMembers")
    .withIndex("by_room", (q) => q.eq("roomId", roomId))
    .collect();
}

function isOnline(lastSeen: number, now: number): boolean {
  return now - lastSeen < ONLINE_MS;
}

async function promoteHost(
  ctx: MutationCtx,
  room: Doc<"multiplayerRooms">,
  members: Doc<"multiplayerMembers">[],
): Promise<Id<"users"> | null> {
  const next = members
    .filter((member) => member.userId !== room.hostId)
    .sort((a, b) => a.joinedAt - b.joinedAt)[0];
  if (!next) return null;
  await ctx.db.patch(room._id, { hostId: next.userId, lastActiveAt: Date.now() });
  return next.userId;
}

async function closeRoom(ctx: MutationCtx, roomId: Id<"multiplayerRooms">): Promise<void> {
  const members = await roomMembers(ctx, roomId);
  for (const member of members) await ctx.db.delete(member._id);
  await ctx.db.patch(roomId, { status: "closed", lastActiveAt: Date.now() });
}

async function awardProgress(
  ctx: MutationCtx,
  userId: Id<"users">,
  xp: number,
  vegetables: number,
  missions: number,
): Promise<void> {
  const existing = await ctx.db
    .query("multiplayerProgress")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .first();
  const now = Date.now();
  if (existing) {
    await ctx.db.patch(existing._id, {
      xp: existing.xp + Math.max(0, xp),
      vegetables: existing.vegetables + Math.max(0, vegetables),
      missions: existing.missions + Math.max(0, missions),
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("multiplayerProgress", {
      userId,
      xp: Math.max(0, xp),
      vegetables: Math.max(0, vegetables),
      missions: Math.max(0, missions),
      updatedAt: now,
    });
  }
}

/** Ends a running mission by timer. Called from heartbeat and room reads. */
async function expireMissionIfNeeded(
  ctx: MutationCtx,
  room: Doc<"multiplayerRooms">,
): Promise<Doc<"multiplayerRooms">> {
  if (room.status !== "in_mission") return room;
  const endsAt = room.missionEndsAt ?? 0;
  if (Date.now() < endsAt) return room;
  await ctx.db.patch(room._id, {
    status: "completed",
    completedAt: Date.now(),
    missionSuccess: false,
    lastActiveAt: Date.now(),
  });
  return (await ctx.db.get(room._id)) as Doc<"multiplayerRooms">;
}

// -------------------------------------------------------------------- queries

/** The current member's active room, used to survive refresh/reconnect. */
export const myRoom = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const memberships = await ctx.db
      .query("multiplayerMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const ordered = memberships.sort((a, b) => b.joinedAt - a.joinedAt);
    for (const membership of ordered) {
      const room = await ctx.db.get(membership.roomId);
      // A finished room should not capture the next visit; its result screen
      // is reached through the room id already stored on the client.
      if (!room || room.status === "closed" || room.status === "completed") continue;
      return { roomId: room._id, code: room.code, status: room.status };
    }
    return null;
  },
});

export const room = query({
  args: { roomId: v.id("multiplayerRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const room = await ctx.db.get(roomId);
    if (!room) return null;
    const self = await findMembership(ctx, roomId, userId);
    if (!self) return null;

    const members = await roomMembers(ctx, roomId);
    const now = Date.now();
    return {
      roomId: room._id,
      code: room.code,
      status: room.status,
      hostId: room.hostId === userId ? "self" : "other",
      isHost: room.hostId === userId,
      createdAt: room.createdAt,
      lastActiveAt: room.lastActiveAt,
      missionStartedAt: room.missionStartedAt ?? null,
      missionEndsAt: room.missionEndsAt ?? null,
      completedAt: room.completedAt ?? null,
      missionSuccess: room.missionSuccess ?? null,
      collected: (room.collected ?? []).map((entry) => ({
        itemId: entry.itemId,
        name: entry.name,
        at: entry.at,
      })),
      members: members
        .sort((a, b) => a.joinedAt - b.joinedAt)
        .map((member) => ({
          memberId: member._id,
          name: member.name,
          houseId: member.houseId,
          characterId: member.characterId,
          ready: member.ready,
          joinedAt: member.joinedAt,
          lastSeen: member.lastSeen,
          online: isOnline(member.lastSeen, now),
          status: member.rewardGranted ? "completed" : room.status === "in_mission" ? "mission" : "lobby",
          contributions: member.contributions,
          isHost: room.hostId === member.userId,
          isSelf: member.userId === userId,
        })),
      self: {
        memberId: self._id,
        name: self.name,
        houseId: self.houseId,
        characterId: self.characterId,
        ready: self.ready,
        contributions: self.contributions,
      },
      maxPlayers: MAX_PLAYERS,
      objective: {
        total: MISSION_VEGETABLE_COUNT,
        collected: (room.collected ?? []).length,
        safeZone: SAFE_ZONE,
      },
    };
  },
});

/** Same data without a known room id (used right after create/join). */
export const roomByCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const room = await ctx.db
      .query("multiplayerRooms")
      .withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase()))
      .first();
    if (!room || room.status === "closed") return null;
    const member = await findMembership(ctx, room._id, userId);
    if (!member) return null;
    return { roomId: room._id, code: room.code };
  },
});

/** Ephemeral positions for remote characters. Members only. */
export const presence = query({
  args: { roomId: v.id("multiplayerRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const self = await findMembership(ctx, roomId, userId);
    if (!self) return [];
    const members = await roomMembers(ctx, roomId);
    return members
      .filter((member) => member.userId !== userId)
      .map((member) => ({
        memberId: member._id,
        name: member.name,
        houseId: member.houseId,
        characterId: member.characterId,
        x: member.x,
        y: member.y,
        z: member.z,
        rotationY: member.rotationY,
        moving: member.moving,
        crouching: member.crouching,
        anim: member.anim,
        lastSeen: member.lastSeen,
      }));
  },
});

export const messages = query({
  args: { roomId: v.id("multiplayerRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const self = await findMembership(ctx, roomId, userId);
    if (!self) return [];
    const rows = await ctx.db
      .query("multiplayerMessages")
      .withIndex("by_room_created", (q) => q.eq("roomId", roomId))
      .order("desc")
      .take(60);
    return rows
      .reverse()
      .map((message) => ({
        messageId: message._id,
        name: message.name,
        houseId: message.houseId,
        text: message.text,
        createdAt: message.createdAt,
        isSelf: message.userId === userId,
      }));
  },
});

export const myProgress = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const progress = await ctx.db
      .query("multiplayerProgress")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();
    return progress
      ? {
          xp: progress.xp,
          vegetables: progress.vegetables,
          missions: progress.missions,
        }
      : { xp: 0, vegetables: 0, missions: 0 };
  },
});

// ------------------------------------------------------------------ mutations

export const createRoom = mutation({
  args: {
    name: v.string(),
    houseId: v.string(),
    characterId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!isHouse(args.houseId)) throw new Error("Choose one of the four campus houses.");

    // One active room per host plus a rolling cap prevents room-spam.
    const hosted = await ctx.db
      .query("multiplayerRooms")
      .withIndex("by_host", (q) => q.eq("hostId", userId))
      .collect();
    for (const room of hosted) {
      if (room.status === "waiting" || room.status === "in_mission") {
        throw new Error("You already have an active room. Leave it before creating another.");
      }
    }
    const recentCreates = hosted.filter((room) => room.createdAt > Date.now() - 10 * 60 * 1000);
    if (recentCreates.length >= 5) {
      throw new Error("That is a lot of rooms in ten minutes. Take a breath and try again shortly.");
    }

    // Drop any stale membership from a different room first.
    const memberships = await ctx.db
      .query("multiplayerMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const membership of memberships) {
      const previous = await ctx.db.get(membership.roomId);
      if (
        previous &&
        (previous.status === "closed" ||
          previous.status === "waiting" ||
          previous.status === "completed")
      ) {
        await ctx.db.delete(membership._id);
        if (previous.status === "waiting") {
          const remaining = await roomMembers(ctx, previous._id);
          if (remaining.length === 0) {
            await ctx.db.patch(previous._id, { status: "closed" });
          } else if (previous.hostId === userId) {
            await promoteHost(ctx, previous, remaining);
          }
        }
      }
    }

    let code = makeCode();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const clash = await ctx.db
        .query("multiplayerRooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!clash || clash.status === "closed") break;
      code = makeCode();
    }

    const now = Date.now();
    const roomId = await ctx.db.insert("multiplayerRooms", {
      code,
      hostId: userId,
      status: "waiting",
      createdAt: now,
      lastActiveAt: now,
      collected: [],
    });
    await ctx.db.insert("multiplayerMembers", {
      roomId,
      userId,
      name: cleanName(args.name),
      houseId: args.houseId,
      characterId: cleanCharacterId(args.characterId),
      ready: true,
      joinedAt: now,
      lastSeen: now,
      x: -38,
      y: 0,
      z: 33.4,
      rotationY: Math.PI,
      moving: false,
      crouching: false,
      anim: "idle",
      contributions: 0,
      rewardGranted: false,
    });
    return { roomId, code };
  },
});

export const joinRoom = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    houseId: v.string(),
    characterId: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    if (!isHouse(args.houseId)) throw new Error("Choose one of the four campus houses.");
    const code = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Room codes are six letters or numbers.");

    const room = await ctx.db
      .query("multiplayerRooms")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();
    if (!room) throw new Error("No room uses that code.");
    if (room.status === "closed") throw new Error("That room is closed.");
    if (room.status === "in_mission") throw new Error("That mission has already started.");
    if (room.status === "completed") throw new Error("That mission is already complete.");

    const existing = await findMembership(ctx, room._id, userId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: cleanName(args.name),
        houseId: args.houseId,
        characterId: cleanCharacterId(args.characterId),
        lastSeen: Date.now(),
      });
      await ctx.db.patch(room._id, { lastActiveAt: Date.now() });
      return { roomId: room._id, code: room.code, reconnected: true };
    }

    const members = await roomMembers(ctx, room._id);
    if (members.length >= MAX_PLAYERS) throw new Error("That room is full.");

    // Leave any other room before joining this one.
    const memberships = await ctx.db
      .query("multiplayerMembers")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    for (const membership of memberships) {
      if (membership.roomId === room._id) continue;
      await ctx.db.delete(membership._id);
      const previous = await ctx.db.get(membership.roomId);
      if (previous) {
        const remaining = await roomMembers(ctx, previous._id);
        if (remaining.length === 0) {
          await ctx.db.patch(previous._id, { status: "closed" });
        } else if (previous.hostId === userId) {
          await promoteHost(ctx, previous, remaining);
        }
      }
    }

    const now = Date.now();
    await ctx.db.insert("multiplayerMembers", {
      roomId: room._id,
      userId,
      name: cleanName(args.name),
      houseId: args.houseId,
      characterId: cleanCharacterId(args.characterId),
      ready: false,
      joinedAt: now,
      lastSeen: now,
      x: -38,
      y: 0,
      z: 33.4,
      rotationY: Math.PI,
      moving: false,
      crouching: false,
      anim: "idle",
      contributions: 0,
      rewardGranted: false,
    });
    await ctx.db.patch(room._id, { lastActiveAt: now });
    return { roomId: room._id, code: room.code, reconnected: false };
  },
});

export const setReady = mutation({
  args: { roomId: v.id("multiplayerRooms"), ready: v.boolean() },
  handler: async (ctx, { roomId, ready }) => {
    const userId = await requireUserId(ctx);
    const { member } = await requireMembership(ctx, roomId, userId);
    await ctx.db.patch(member._id, { ready, lastSeen: Date.now() });
    return { ready };
  },
});

export const leaveRoom = mutation({
  args: { roomId: v.id("multiplayerRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const room = await ctx.db.get(roomId);
    if (!room) return { left: true };
    const member = await findMembership(ctx, roomId, userId);
    if (member) await ctx.db.delete(member._id);
    const remaining = await roomMembers(ctx, roomId);
    if (remaining.length === 0) {
      await ctx.db.patch(roomId, { status: "closed", lastActiveAt: Date.now() });
    } else if (room.hostId === userId) {
      await promoteHost(ctx, room, remaining);
    }
    return { left: true };
  },
});

export const startMission = mutation({
  args: { roomId: v.id("multiplayerRooms") },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const { room, member } = await requireMembership(ctx, roomId, userId);
    if (room.hostId !== userId) throw new Error("Only the host can start the mission.");
    if (room.status === "in_mission") return { started: true };
    if (room.status !== "waiting") throw new Error("This room can no longer start a mission.");
    const members = await roomMembers(ctx, roomId);
    if (members.length === 0) throw new Error("The room is empty.");
    if (members.length > MAX_PLAYERS) throw new Error("That is more than four players.");
    const now = Date.now();
    for (const other of members) {
      await ctx.db.patch(other._id, {
        contributions: 0,
        rewardGranted: false,
        lastSeen: other._id === member._id ? now : other.lastSeen,
        ready: true,
      });
    }
    await ctx.db.patch(roomId, {
      status: "in_mission",
      missionStartedAt: now,
      missionEndsAt: now + MISSION_DURATION_MS,
      completedAt: undefined,
      missionSuccess: undefined,
      collected: [],
      lastActiveAt: now,
    });
    return { started: true };
  },
});

/** Presence heartbeat. Stops when the tab is hidden, so online is never faked. */
export const heartbeat = mutation({
  args: {
    roomId: v.id("multiplayerRooms"),
    status: v.optional(v.union(v.literal("lobby"), v.literal("mission"))),
  },
  handler: async (ctx, { roomId }) => {
    const userId = await requireUserId(ctx);
    const { room, member } = await requireMembership(ctx, roomId, userId);
    const now = Date.now();
    await ctx.db.patch(member._id, { lastSeen: now });
    const fresh = await expireMissionIfNeeded(ctx, room);
    await ctx.db.patch(roomId, { lastActiveAt: now });
    return { status: fresh.status, serverTime: now, endsAt: fresh.missionEndsAt ?? null };
  },
});

export const syncPlayer = mutation({
  args: {
    roomId: v.id("multiplayerRooms"),
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
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { room, member } = await requireMembership(ctx, args.roomId, userId);
    if (room.status !== "in_mission" && room.status !== "waiting" && room.status !== "completed") {
      return { ok: false };
    }
    const now = Date.now();
    await ctx.db.patch(member._id, {
      x: clampNumber(args.x, WORLD_BOUNDS),
      y: clampNumber(args.y, 4),
      z: clampNumber(args.z, WORLD_BOUNDS),
      rotationY: Number.isFinite(args.rotationY) ? args.rotationY : 0,
      moving: args.moving === true,
      crouching: args.crouching === true,
      anim: args.anim,
      lastSeen: now,
    });
    await ctx.db.patch(args.roomId, { lastActiveAt: now });
    return { ok: true };
  },
});

export const collectVegetable = mutation({
  args: {
    roomId: v.id("multiplayerRooms"),
    itemId: v.string(),
    x: v.number(),
    z: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { room, member } = await requireMembership(ctx, args.roomId, userId);
    if (room.status !== "in_mission") throw new Error("The mission is not running.");
    if ((room.missionEndsAt ?? 0) < Date.now()) {
      throw new Error("The six-minute mission window has closed.");
    }
    if (!VEGETABLE_IDS.has(args.itemId)) throw new Error("Unknown vegetable crate.");

    const collected = room.collected ?? [];
    if (collected.some((entry) => entry.itemId === args.itemId)) {
      throw new Error("Another player already collected that crate.");
    }
    if (collected.length >= MISSION_VEGETABLE_COUNT) {
      throw new Error("The team has already collected every crate.");
    }

    const item = VEGETABLES.find((candidate) => candidate.id === args.itemId);
    if (!item) throw new Error("Unknown vegetable crate.");
    const atItem = Math.hypot(args.x - item.x, args.z - item.z);
    const fromMember = Math.hypot(args.x - member.x, args.z - member.z);
    if (atItem > COLLECT_RADIUS || fromMember > COLLECT_RADIUS) {
      throw new Error("You need to be at the crate to collect it.");
    }

    const now = Date.now();
    await ctx.db.patch(room._id, {
      collected: [
        ...collected,
        { itemId: args.itemId, userId, name: member.name, at: now },
      ],
      lastActiveAt: now,
    });
    await ctx.db.patch(member._id, {
      contributions: member.contributions + 1,
      lastSeen: now,
    });
    await awardProgress(ctx, userId, 10, 1, 0);
    const total = collected.length + 1;
    return {
      collected: total,
      total: MISSION_VEGETABLE_COUNT,
      itemId: args.itemId,
      complete: total >= MISSION_VEGETABLE_COUNT,
    };
  },
});

export const returnToSafeArea = mutation({
  args: { roomId: v.id("multiplayerRooms"), x: v.number(), z: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { room } = await requireMembership(ctx, args.roomId, userId);
    if (room.status !== "in_mission") throw new Error("The mission is not running.");
    if ((room.missionEndsAt ?? 0) < Date.now()) {
      throw new Error("The six-minute mission window has closed.");
    }
    const collected = room.collected ?? [];
    if (collected.length < MISSION_VEGETABLE_COUNT) {
      throw new Error("Collect all ten crates before returning to the safe area.");
    }
    if (Math.hypot(args.x - SAFE_ZONE.x, args.z - SAFE_ZONE.z) > SAFE_ZONE.radius + 1.2) {
      throw new Error("Stand inside the marked safe area to finish.");
    }
    const now = Date.now();
    await ctx.db.patch(room._id, {
      status: "completed",
      completedAt: now,
      missionSuccess: true,
      lastActiveAt: now,
    });
    // Team completion reward is granted once per member, in this same mutation.
    const members = await roomMembers(ctx, room._id);
    for (const member of members) {
      if (member.rewardGranted) continue;
      await ctx.db.patch(member._id, { rewardGranted: true, lastSeen: now });
      await awardProgress(ctx, member.userId, 60, 0, 1);
    }
    return { completed: true, teamXp: 60 };
  },
});

export const sendMessage = mutation({
  args: { roomId: v.id("multiplayerRooms"), text: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const { member } = await requireMembership(ctx, args.roomId, userId);
    const text = cleanText(args.text);
    if (text.length === 0) throw new Error("Write a message first.");
    if (args.text.length > CHAT_MAX_LENGTH * 2) throw new Error("That message is too long.");

    const now = Date.now();
    const recent = await ctx.db
      .query("multiplayerMessages")
      .withIndex("by_room_created", (q) =>
        q.eq("roomId", args.roomId).gt("createdAt", now - CHAT_WINDOW_MS),
      )
      .collect();
    const mine = recent.filter((message) => message.userId === userId).length;
    if (mine >= CHAT_MAX_IN_WINDOW) {
      throw new Error("Slow down — a few messages at a time is plenty.");
    }

    await ctx.db.insert("multiplayerMessages", {
      roomId: args.roomId,
      userId,
      name: member.name,
      houseId: member.houseId,
      text,
      createdAt: now,
    });
    await ctx.db.patch(member._id, { lastSeen: now });
    return { sent: true };
  },
});

export const reportMessage = mutation({
  args: {
    roomId: v.id("multiplayerRooms"),
    messageId: v.id("multiplayerMessages"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    await requireMembership(ctx, args.roomId, userId);
    const message = await ctx.db.get(args.messageId);
    if (!message || message.roomId !== args.roomId) {
      throw new Error("That message is not in this room.");
    }
    if (message.userId === userId) throw new Error("You cannot report your own message.");
    const duplicate = await ctx.db
      .query("multiplayerReports")
      .withIndex("by_message_reporter", (q) =>
        q.eq("messageId", args.messageId).eq("reporterId", userId),
      )
      .first();
    if (duplicate) return { reported: true };
    await ctx.db.insert("multiplayerReports", {
      roomId: args.roomId,
      messageId: args.messageId,
      reporterId: userId,
      reason: cleanText(args.reason).slice(0, 120) || "Unspecified",
      createdAt: Date.now(),
    });
    return { reported: true };
  },
});

// -------------------------------------------------------------------- cleanup

/** Periodic cleanup: stale members, abandoned rooms, finished missions. */
export const cleanup = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const rooms = await ctx.db.query("multiplayerRooms").collect();
    let closed = 0;
    let expired = 0;

    for (const room of rooms) {
      if (room.status === "closed") continue;
      const members = await roomMembers(ctx, room._id);

      // During a mission, keep disconnected membership rows so a refreshing
      // player can rejoin the same room; presence is derived from lastSeen.
      if (room.status !== "in_mission") {
        for (const member of members) {
          if (now - member.lastSeen > STALE_MEMBER_MS) {
            await ctx.db.delete(member._id);
            expired += 1;
          }
        }
      }

      const remaining = await roomMembers(ctx, room._id);
      if (remaining.length === 0) {
        await ctx.db.patch(room._id, { status: "closed", lastActiveAt: now });
        closed += 1;
        continue;
      }
      if (room.hostId && !remaining.some((member) => member.userId === room.hostId)) {
        await promoteHost(ctx, room, remaining);
      }
      if (room.status === "in_mission" && (room.missionEndsAt ?? 0) < now) {
        await ctx.db.patch(room._id, {
          status: "completed",
          completedAt: now,
          missionSuccess: false,
          lastActiveAt: now,
        });
      }
      const idleLimit = room.status === "in_mission" ? ROOM_IDLE_MISSION_MS : ROOM_IDLE_MS;
      if (now - room.lastActiveAt > idleLimit) {
        await closeRoom(ctx, room._id);
        closed += 1;
      }
    }

    return { closed, expired };
  },
});
