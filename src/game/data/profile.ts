import { levelFromXp, validAchievementIds } from "./achievements";
import { getHouse } from "./houses";
import { getStudent, validateCharacterSelection } from "./students";
import type { PlayerProfileSave, PlayerProfileView } from "../core/types";

export function createPlayerId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to a local-only identifier */
  }
  return `navodaya-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function newPlayerProfile(
  characterId: string,
  houseId: string,
  options: { playerId?: string; assignedAt?: number; xp?: number; achievements?: string[] } = {},
): PlayerProfileSave {
  const student = getStudent(characterId);
  if (!student || student.houseId !== houseId) {
    throw new Error("Cannot create a profile for an invalid character/house pair.");
  }
  const achievements = validAchievementIds(options.achievements ?? []);
  if (!achievements.includes("house-colours")) achievements.push("house-colours");
  const xp = Math.max(0, Math.floor(options.xp ?? 0));
  return {
    playerId: options.playerId ?? createPlayerId(),
    characterId,
    houseId: student.houseId,
    assignedAt: options.assignedAt ?? Date.now(),
    xp,
    level: levelFromXp(xp),
    achievements,
  };
}

export function toProfileView(save: PlayerProfileSave): PlayerProfileView | null {
  const validation = validateCharacterSelection(save.characterId, save.houseId);
  if (!validation.ok) return null;
  const house = getHouse(save.houseId);
  if (!house) return null;
  return {
    playerId: save.playerId,
    characterId: save.characterId,
    characterName: validation.student.displayName,
    houseId: save.houseId,
    houseName: house.name,
    houseColor: house.color,
    className: validation.student.className,
    xp: save.xp,
    level: levelFromXp(save.xp),
    achievements: [...save.achievements],
    assignedAt: save.assignedAt,
  };
}

export function awardProgress(
  profile: PlayerProfileSave,
  xpAmount: number,
  achievementId: string | null,
): { profile: PlayerProfileSave; awardedXp: number; achievementAdded: boolean } {
  const alreadyHasAchievement =
    achievementId !== null && profile.achievements.includes(achievementId);
  const awardableXp = alreadyHasAchievement ? 0 : Math.max(0, Math.floor(xpAmount));
  const achievements = [...profile.achievements];
  let achievementAdded = false;
  if (achievementId && !alreadyHasAchievement) {
    achievements.push(achievementId);
    achievementAdded = true;
  }
  const xp = profile.xp + awardableXp;
  return {
    profile: {
      ...profile,
      xp,
      level: levelFromXp(xp),
      achievements,
    },
    awardedXp: awardableXp,
    achievementAdded,
  };
}
