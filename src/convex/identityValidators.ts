import { v } from "convex/values";

export const appearanceValidator = v.object({
  uniform: v.union(v.literal("navy"), v.literal("olive"), v.literal("maroon")),
  skin: v.union(v.literal(0), v.literal(1), v.literal(2), v.literal(3)),
  face: v.union(v.literal("oval"), v.literal("round"), v.literal("square")),
  hairStyle: v.union(
    v.literal("short"),
    v.literal("side"),
    v.literal("curly"),
    v.literal("bun"),
    v.literal("braid"),
  ),
  hairColor: v.union(v.literal("black"), v.literal("brown"), v.literal("soft")),
  eyeColor: v.union(v.literal("brown"), v.literal("dark"), v.literal("hazel")),
  brows: v.union(v.literal("straight"), v.literal("soft"), v.literal("bold")),
  build: v.union(v.literal("slim"), v.literal("regular"), v.literal("broad")),
  glasses: v.union(v.literal("none"), v.literal("round"), v.literal("rect")),
  watch: v.union(v.literal("none"), v.literal("steel"), v.literal("black")),
  backpack: v.union(v.literal("none"), v.literal("navy"), v.literal("olive")),
});

export const achievementRecordValidator = v.object({
  id: v.string(),
  unlockedAt: v.number(),
});

export const xpHistoryValidator = v.object({
  kind: v.string(),
  label: v.string(),
  xp: v.number(),
  at: v.number(),
});
