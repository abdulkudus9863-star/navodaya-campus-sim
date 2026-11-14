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
    name: "Midnight Mischief",
    description: "Completed Operation Midnight Mischief without being caught.",
  },
  {
    id: "caught-in-the-act",
    name: "Caught in the Act",
    description: "Discovered that teachers label their tomatoes.",
  },
  {
    id: "garden-duty",
    name: "Garden Duty",
    description: "Helped Mr. Barua with the beds after the midnight incident.",
  },
  {
    id: "campus-wanderer",
    name: "Campus Wanderer",
    description: "Explored three named places on the campus route.",
  },
  {
    id: "campus-cartographer",
    name: "Campus Cartographer",
    description: "Explored six named places on the campus route.",
  },
  {
    id: "campus-life",
    name: "Campus Life",
    description: "Visited every stop on the interpretive campus route.",
  },
  {
    id: "escape-first-run",
    name: "First Run",
    description: "Completed your first Campus Escape level.",
  },
  {
    id: "escape-collector",
    name: "Collector",
    description: "Collected every energy token in a Campus Escape level.",
  },
  {
    id: "escape-perfect",
    name: "Perfect Run",
    description: "Finished a Campus Escape level without falling or colliding.",
  },
  {
    id: "escape-speed",
    name: "Speed Runner",
    description: "Finished a Campus Escape level under its target time.",
  },
  {
    id: "escape-champion",
    name: "Campus Champion",
    description: "Completed all three Campus Escape levels.",
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

/**
 * XP is only ever awarded alongside a first-time achievement. Keeping the
 * mapping here lets the save boundary cap a tampered XP value to the rewards
 * the profile actually holds. This is local-save hardening, not a substitute
 * for server authority in a multiplayer build.
 */
export const ACHIEVEMENT_XP: Record<string, number> = {
  "house-colours": 0,
  "first-day": 120,
  "midnight-garden": 60,
  "caught-in-the-act": 0,
  "garden-duty": 0,
  "campus-wanderer": 40,
  "campus-cartographer": 80,
  "campus-life": 120,
  "escape-first-run": 0,
  "escape-collector": 0,
  "escape-perfect": 0,
  "escape-speed": 0,
  "escape-champion": 0,
};

export function maxXpForAchievements(ids: readonly string[]): number {
  return ids.reduce((total, id) => total + (ACHIEVEMENT_XP[id] ?? 0), 0);
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
