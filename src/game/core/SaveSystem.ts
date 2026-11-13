import {
  DEFAULT_CHARACTER,
  DEFAULT_SETTINGS,
  MISSION_STEPS,
  type CharacterSettings,
  type GameSettings,
  type NightSave,
  type PlayerProfileSave,
  type Quality,
  type SaveData,
} from "./types";
import { levelFromXp, maxXpForAchievements, validAchievementIds } from "../data/achievements";
import { DEFAULT_CHARACTER_ID, DEFAULT_HOUSE_ID, isHouseId } from "../data/houses";
import { GARDEN_ITEM_IDS, NIGHT_TOTAL_STEPS, isGardenItemId } from "../data/night";
import { newPlayerProfile } from "../data/profile";
import { getStudent, validateCharacterSelection } from "../data/students";
import { sanitizeExploration } from "../systems/ExplorationSystem";

const KEY = "navodaya.campus.save.v1";
const QUALITIES: Quality[] = ["low", "medium", "high"];
const UNIFORMS: CharacterSettings["uniform"][] = ["navy", "olive", "maroon"];
const WORLD_LIMIT = 70;
const MAX_XP = 1_000_000;

type LoadResult =
  | { ok: true; data: SaveData }
  | { ok: false; reason: "missing" | "corrupt" | "unavailable" };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function sanitizeSettings(raw: unknown): GameSettings {
  const source = (raw ?? {}) as Partial<GameSettings>;
  return {
    quality: QUALITIES.includes(source.quality as Quality)
      ? (source.quality as Quality)
      : DEFAULT_SETTINGS.quality,
    sensitivity: clamp(num(source.sensitivity, DEFAULT_SETTINGS.sensitivity), 0.2, 2.5),
    invertY: typeof source.invertY === "boolean" ? source.invertY : DEFAULT_SETTINGS.invertY,
    volume: clamp(num(source.volume, DEFAULT_SETTINGS.volume), 0, 1),
    music: typeof source.music === "boolean" ? source.music : DEFAULT_SETTINGS.music,
    sfx: typeof source.sfx === "boolean" ? source.sfx : DEFAULT_SETTINGS.sfx,
  };
}

export function sanitizeCharacter(raw: unknown): CharacterSettings {
  const source = (raw ?? {}) as Partial<CharacterSettings>;
  return {
    uniform: UNIFORMS.includes(source.uniform as CharacterSettings["uniform"])
      ? (source.uniform as CharacterSettings["uniform"])
      : DEFAULT_CHARACTER.uniform,
    skin: ([0, 1, 2, 3] as const).includes(source.skin as 0)
      ? (source.skin as 0 | 1 | 2 | 3)
      : DEFAULT_CHARACTER.skin,
  };
}

function sanitizeNight(raw: unknown): NightSave {
  const source = (raw ?? {}) as Partial<NightSave>;
  const collectedRaw = Array.isArray(source.collected) ? source.collected : [];
  const collected = Array.from(
    new Set(collectedRaw.filter((id): id is (typeof GARDEN_ITEM_IDS)[number] => isGardenItemId(id))),
  );
  const success = source.success === true && collected.length === GARDEN_ITEM_IDS.length;
  const caught = source.caught === true && !success;
  const active = source.active === true && !success && !caught;
  let step = clamp(Math.floor(num(source.step, 0)), 0, NIGHT_TOTAL_STEPS);
  if (active && step === NIGHT_TOTAL_STEPS && collected.length < GARDEN_ITEM_IDS.length) {
    step = NIGHT_TOTAL_STEPS - 1;
  }
  return {
    active,
    started: source.started === true || active || success || caught,
    step: success ? NIGHT_TOTAL_STEPS : step,
    collected: caught ? [] : collected,
    attempts: clamp(Math.floor(num(source.attempts, 0)), 0, 999),
    caught,
    success,
    completedAt:
      success && Number.isFinite(source.completedAt) ? (source.completedAt as number) : null,
  };
}

function sanitizeProfile(
  raw: unknown,
  version: number,
  savedAt: number,
  missionDone: boolean,
): PlayerProfileSave | null {
  if (version === 1) {
    // Preserve a Phase 1 save without forcing the player through creation again.
    return newPlayerProfile(DEFAULT_CHARACTER_ID, DEFAULT_HOUSE_ID, {
      assignedAt: savedAt,
      xp: missionDone ? 120 : 0,
      achievements: missionDone ? ["first-day"] : [],
    });
  }
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<PlayerProfileSave>;
  if (typeof source.playerId !== "string" || source.playerId.length < 4 || source.playerId.length > 80) {
    return null;
  }
  if (typeof source.characterId !== "string" || typeof source.houseId !== "string") return null;
  if (!isHouseId(source.houseId)) return null;
  const validation = validateCharacterSelection(source.characterId, source.houseId);
  if (!validation.ok) return null;
  if (!getStudent(source.characterId)) return null;
  const achievements = validAchievementIds(source.achievements);
  if (!achievements.includes("house-colours")) achievements.push("house-colours");
  const xp = Math.min(
    clamp(Math.floor(num(source.xp, 0)), 0, MAX_XP),
    maxXpForAchievements(achievements),
  );
  return {
    playerId: source.playerId,
    characterId: source.characterId,
    houseId: source.houseId,
    assignedAt: clamp(num(source.assignedAt, savedAt), 0, 8_640_000_000_000_000),
    xp,
    level: levelFromXp(xp),
    achievements,
  };
}

/** Validates an untrusted payload (localStorage can be edited or half-written). */
function sanitizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const version = source.version === 1 ? 1 : source.version === 2 ? 2 : null;
  if (!version) return null;

  const player = source.player as Record<string, unknown> | undefined;
  if (!player || typeof player !== "object") return null;
  const position = player.position as Record<string, unknown> | undefined;
  if (!position || typeof position !== "object") return null;
  const x = num(position.x, Number.NaN);
  const y = num(position.y, Number.NaN);
  const z = num(position.z, Number.NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;
  if (Math.abs(x) > WORLD_LIMIT || Math.abs(z) > WORLD_LIMIT) return null;

  const mission = source.mission as Record<string, unknown> | undefined;
  if (!mission || typeof mission !== "object") return null;
  const completedRaw = Array.isArray(mission.completed) ? mission.completed : [];
  const validIds = new Set(MISSION_STEPS.map((s) => s.id));
  const completed = Array.from(
    new Set(
      completedRaw.filter(
        (id): id is string => typeof id === "string" && validIds.has(id),
      ),
    ),
  );
  const step = clamp(Math.floor(num(mission.step, completed.length)), 0, MISSION_STEPS.length);
  const missionDone = completed.length >= MISSION_STEPS.length;

  const savedAt = num(source.savedAt, Date.now());
  const profile = sanitizeProfile(source.profile, version, savedAt, missionDone);
  if (!profile) return null;

  return {
    version: 2,
    savedAt,
    playtime: clamp(num(source.playtime, 0), 0, 60 * 60 * 100),
    player: {
      position: {
        x: clamp(x, -WORLD_LIMIT, WORLD_LIMIT),
        y: clamp(y, 0, 8),
        z: clamp(z, -WORLD_LIMIT, WORLD_LIMIT),
      },
      rotationY: num(player.rotationY, 0),
    },
    settings: sanitizeSettings(source.settings),
    character: sanitizeCharacter(source.character),
    mission: {
      started: mission.started !== false,
      step,
      completed,
    },
    profile,
    night: sanitizeNight(source.night),
    exploration: sanitizeExploration(source.exploration),
  };
}

export class SaveSystem {
  available(): boolean {
    try {
      const probe = "__navodaya_probe__";
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  }

  load(): LoadResult {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(KEY);
    } catch {
      return { ok: false, reason: "unavailable" };
    }
    if (!raw) return { ok: false, reason: "missing" };

    try {
      const parsed: unknown = JSON.parse(raw);
      const data = sanitizeSave(parsed);
      if (!data) {
        // A malformed profile or impossible house assignment is rejected at the
        // boundary rather than silently repaired into a different character.
        window.localStorage.removeItem(KEY);
        return { ok: false, reason: "corrupt" };
      }
      return { ok: true, data };
    } catch {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        /* storage may be blocked; nothing else to do */
      }
      return { ok: false, reason: "corrupt" };
    }
  }

  save(data: SaveData): boolean {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  clear(): void {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}

export const saveKey = KEY;
