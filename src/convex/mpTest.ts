import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Temporary QA helpers for the multiplayer acceptance run. They create signed-in
 * test users and remove their data afterwards; nothing here is used by the game.
 */
export const seedUsers = internalMutation({
  args: { count: v.number() },
  handler: async (ctx, { count }) => {
    const ids: string[] = [];
    for (let index = 0; index < Math.min(6, Math.max(1, count)); index += 1) {
      const id = await ctx.db.insert("users", { name: `QA Player ${index + 1}` });
      ids.push(id);
    }
    return ids;
  },
});

export const ageAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const old = Date.now() - 100_000;
    const rooms = await ctx.db.query("multiplayerRooms").collect();
    for (const room of rooms) {
      const members = await ctx.db
        .query("multiplayerMembers")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      for (const member of members) {
        await ctx.db.patch(member._id, { lastSeen: old });
      }
      await ctx.db.patch(room._id, { lastActiveAt: old });
    }
    return { aged: rooms.length };
  },
});

export const purge = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rooms = await ctx.db.query("multiplayerRooms").collect();
    for (const room of rooms) {
      const members = await ctx.db
        .query("multiplayerMembers")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      for (const member of members) await ctx.db.delete(member._id);
      const messages = await ctx.db
        .query("multiplayerMessages")
        .withIndex("by_room_created", (q) => q.eq("roomId", room._id))
        .collect();
      for (const message of messages) await ctx.db.delete(message._id);
      const reports = await ctx.db
        .query("multiplayerReports")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect();
      for (const report of reports) await ctx.db.delete(report._id);
      await ctx.db.delete(room._id);
    }
    const progress = await ctx.db.query("multiplayerProgress").collect();
    for (const row of progress) await ctx.db.delete(row._id);
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      if (user.name?.startsWith("QA Player")) await ctx.db.delete(user._id);
    }
    return { cleared: true };
  },
});
