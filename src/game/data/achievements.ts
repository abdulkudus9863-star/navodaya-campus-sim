export interface AchievementDefinition {
  id: string;
  name: string;
  description: string;
}

export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    id: "house-colours",
    name: "House Colours",
    description: "Confirmed a house and joined the campus.",
  },
  {
    id: "first-day",
    name: "First Day",
    description: "Completed the day-one orientation.",
  },
  {
    id: "midnight-garden",
    name: "Midnight Gardener",
    description: "Returned from the teachers' garden unseen.",
  },
  {
    id: "caught-in-the-act",
    name: "Caught in the Act",
    description: "Discovered that teachers label their tomatoes.",
  },
];

export function getAchievement(id: string): AchievementDefinition | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}

export function validAchievementIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  return Array.from(
    new Set(ids.filter((id): id is string => typeof id === "string" && Boolean(getAchievement(id)))),
  );
}

export const XP_PER_LEVEL = 100;

export function levelFromXp(xp: number): number {
  return Math.max(1, Math.floor(Math.max(0, xp) / XP_PER_LEVEL) + 1);
}

export function xpProgress(xp: number): {
  level: number;
  inLevel: number;
  toNext: number;
  percent: number;
} {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safe);
  const inLevel = safe % XP_PER_LEVEL;
  return {
    level,
    inLevel,
    toNext: XP_PER_LEVEL - inLevel,
    percent: Math.round((inLevel / XP_PER_LEVEL) * 100),
  };
}
