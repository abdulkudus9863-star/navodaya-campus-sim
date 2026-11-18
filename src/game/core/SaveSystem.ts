import {
  DEFAULT_CHARACTER,
  DEFAULT_SETTINGS,
  MISSION_STEPS,
  type CharacterSettings,
  type GameSettings,
  type NightSave,
  type PlayerProfileSave,
  type PrincipalReferralSave,
  type Quality,
  type SaveData,
} from "./types";
import { levelFromXp, maxXpForAchievements, validAchievementIds } from "../data/achievements";
import { DEFAULT_CHARACTER_ID, DEFAULT_HOUSE_ID, isHouseId } from "../data/houses";
import { GARDEN_ITEM_IDS, NIGHT_TOTAL_STEPS, isGardenItemId } from "../data/night";
import { newPlayerProfile } from "../data/profile";
import { emptyEscapeSave, sanitizeEscape } from "../data/escape";
import {
  CLASS_BUNK_OBJECTIVES,
  emptyClassBunkSave,
  isClassBunkDifficulty,
  type ClassBunkSave,
} from "../data/classBunk";
import {
  MESS_MEAL_CHECKPOINTS,
  emptyMessMealSave,
  isMessMealDifficulty,
  type MessMealSave,
  type MessMealStatus,
} from "../data/messMeal";
import { isTeacherId } from "../data/teachers";
import { getStudent, validateCharacterSelection } from "../data/students";
import { sanitizeExploration } from "../systems/ExplorationSystem";
import { emptyPrincipalReferral } from "../systems/PrincipalReferralSystem";
import { TeacherMemoryManager } from "../teachers/TeacherMemoryManager";
import type { TeacherSave } from "./types";

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

const FACES: CharacterSettings["face"][] = ["oval", "round", "square"];
const HAIR_STYLES: CharacterSettings["hairStyle"][] = ["short", "side", "curly", "bun", "braid"];
const HAIR_COLORS: CharacterSettings["hairColor"][] = ["black", "brown", "soft"];
const EYE_COLORS: CharacterSettings["eyeColor"][] = ["brown", "dark", "hazel"];
const BROWS: CharacterSettings["brows"][] = ["straight", "soft", "bold"];
const BUILDS: CharacterSettings["build"][] = ["slim", "regular", "broad"];
const GLASSES: CharacterSettings["glasses"][] = ["none", "round", "rect"];
const WATCHES: CharacterSettings["watch"][] = ["none", "steel", "black"];
const BACKPACKS: CharacterSettings["backpack"][] = ["none", "navy", "olive"];

function option<T extends string>(values: readonly T[], raw: unknown, fallback: T): T {
  return values.includes(raw as T) ? (raw as T) : fallback;
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
    face: option(FACES, source.face, DEFAULT_CHARACTER.face),
    hairStyle: option(HAIR_STYLES, source.hairStyle, DEFAULT_CHARACTER.hairStyle),
    hairColor: option(HAIR_COLORS, source.hairColor, DEFAULT_CHARACTER.hairColor),
    eyeColor: option(EYE_COLORS, source.eyeColor, DEFAULT_CHARACTER.eyeColor),
    brows: option(BROWS, source.brows, DEFAULT_CHARACTER.brows),
    build: option(BUILDS, source.build, DEFAULT_CHARACTER.build),
    glasses: option(GLASSES, source.glasses, DEFAULT_CHARACTER.glasses),
    watch: option(WATCHES, source.watch, DEFAULT_CHARACTER.watch),
    backpack: option(BACKPACKS, source.backpack, DEFAULT_CHARACTER.backpack),
  };
}

function sanitizeTeachers(raw: unknown): TeacherSave {
  // The memory manager clamps counts, validates teacher IDs and caps history,
  // so an edited localStorage payload cannot create a huge or corrupt state.
  return new TeacherMemoryManager(raw as TeacherSave | undefined).toSave();
}

function sanitizePrincipalReferral(raw: unknown): PrincipalReferralSave {
  const fallback = emptyPrincipalReferral();
  if (!raw || typeof raw !== "object") return fallback;
  const source = raw as Partial<PrincipalReferralSave>;
  const status =
    source.status === "assigned" || source.status === "in-progress" || source.status === "completed"
      ? source.status
      : source.active === true
        ? "assigned"
        : "completed";
  const active = source.active === true && status !== "completed";
  return {
    active,
    status: active ? status : "completed",
    teacherId: typeof source.teacherId === "string" ? source.teacherId.slice(0, 32) : null,
    teacherName: typeof source.teacherName === "string" ? source.teacherName.slice(0, 80) : null,
    reason: typeof source.reason === "string" ? source.reason.slice(0, 180) : null,
    assignedAt: clamp(num(source.assignedAt, 0), 0, 8_640_000_000_000_000),
    completedAt:
      source.completedAt == null
        ? null
        : clamp(num(source.completedAt, 0), 0, 8_640_000_000_000_000),
  };
}

function sanitizeClassBunk(raw: unknown): ClassBunkSave {
  const fallback = emptyClassBunkSave();
  if (!raw || typeof raw !== "object") return fallback;
  const source = raw as Partial<ClassBunkSave>;
  const difficulty = isClassBunkDifficulty(source.difficulty) ? source.difficulty : "normal";
  const objectiveIds = Array.isArray(source.objectiveIds)
    ? Array.from(
        new Set(
          source.objectiveIds.filter((id): id is string =>
            CLASS_BUNK_OBJECTIVES.some((objective) => objective.id === id),
          ),
        ),
      )
    : [];
  const completedIds = Array.isArray(source.completedIds)
    ? Array.from(
        new Set(source.completedIds.filter((id): id is string => objectiveIds.includes(id))),
      )
    : [];
  const status =
    source.status === "return" ||
    source.status === "caught" ||
    source.status === "completed" ||
    source.status === "failed" ||
    source.status === "ended"
      ? source.status
      : "exploring";
  const active =
    source.active === true &&
    objectiveIds.length > 0 &&
    status !== "completed" &&
    status !== "failed" &&
    status !== "ended";
  return {
    active,
    difficulty,
    objectiveIds: active ? objectiveIds : [],
    completedIds: active ? completedIds : [],
    remaining: active ? clamp(Math.round(num(source.remaining, 0)), 1, 600) : 0,
    suspicion: active ? clamp(Math.round(num(source.suspicion, 0)), 0, 99) : 0,
    status: active ? status : source.status === "completed" ? "completed" : source.status === "failed" ? "failed" : "ended",
    caughtBy: active && isTeacherId(source.caughtBy) ? source.caughtBy : null,
    completedOnce: source.completedOnce === true || (!active && status === "completed"),
    resultSeen: source.resultSeen !== false,
  };
}

function sanitizeMessMeal(raw: unknown): MessMealSave {
  const fallback = emptyMessMealSave();
  if (!raw || typeof raw !== "object") return fallback;
  const source = raw as Partial<MessMealSave>;
  const difficulty = isMessMealDifficulty(source.difficulty) ? source.difficulty : "normal";
  const checkpointIds = Array.isArray(source.checkpointIds)
    ? Array.from(
        new Set(
          source.checkpointIds.filter((id): id is string =>
            MESS_MEAL_CHECKPOINTS.some((checkpoint) => checkpoint.id === id),
          ),
        ),
      )
    : [];
  const completedCheckpointIds = Array.isArray(source.completedCheckpointIds)
    ? Array.from(
        new Set(
          source.completedCheckpointIds.filter((id): id is string =>
            checkpointIds.includes(id),
          ),
        ),
      )
    : [];
  let status: MessMealStatus =
    source.status === "return" ||
    source.status === "caught" ||
    source.status === "completed" ||
    source.status === "failed" ||
    source.status === "ended"
      ? source.status
      : "to-mess";
  const mealCollected = source.mealCollected === true;
  const active =
    source.active === true &&
    status !== "completed" &&
    status !== "failed" &&
    status !== "ended";
  if (active && status === "to-mess" && mealCollected) status = "return";
  if (active && status === "return" && !mealCollected) status = "to-mess";
  return {
    active,
    difficulty,
    status: active
      ? status
      : source.status === "completed"
        ? "completed"
        : source.status === "failed"
          ? "failed"
          : "ended",
    mealCollected,
    checkpointIds: active ? checkpointIds : [],
    completedCheckpointIds: active ? completedCheckpointIds : [],
    suspicion: active ? clamp(Math.round(num(source.suspicion, 0)), 0, 99) : 0,
    caughtBy: active && isTeacherId(source.caughtBy) ? source.caughtBy : null,
    completedOnce: source.completedOnce === true || (!active && status === "completed"),
    resultSeen: source.resultSeen !== false,
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
    escape:
      version === 1
        ? emptyEscapeSave(profile.playerId)
        : sanitizeEscape(source.escape, profile.playerId),
    teachers: sanitizeTeachers(source.teachers),
    principalReferral: sanitizePrincipalReferral(source.principalReferral),
    classBunk: sanitizeClassBunk(source.classBunk),
    messMeal: sanitizeMessMeal(source.messMeal),
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
