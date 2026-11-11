import {
  DEFAULT_CHARACTER,
  DEFAULT_SETTINGS,
  MISSION_STEPS,
  type CharacterSettings,
  type GameSettings,
  type Quality,
  type SaveData,
} from "./types";

const KEY = "navodaya.campus.save.v1";
const QUALITIES: Quality[] = ["low", "medium", "high"];
const UNIFORMS: CharacterSettings["uniform"][] = ["navy", "olive", "maroon"];
const WORLD_LIMIT = 70;

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
      ? (source.skin as CharacterSettings["skin"])
      : DEFAULT_CHARACTER.skin,
  };
}

/** Validates an untrusted payload (localStorage can be edited or half-written). */
function sanitizeSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  if (source.version !== 1) return null;

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
  const completed = completedRaw.filter(
    (id): id is string => typeof id === "string" && validIds.has(id),
  );
  const step = clamp(Math.floor(num(mission.step, completed.length)), 0, MISSION_STEPS.length);

  return {
    version: 1,
    savedAt: num(source.savedAt, Date.now()),
    playtime: clamp(num(source.playtime, 0), 0, 60 * 60 * 100),
    player: {
      position: { x: clamp(x, -WORLD_LIMIT, WORLD_LIMIT), y: clamp(y, 0, 8), z: clamp(z, -WORLD_LIMIT, WORLD_LIMIT) },
      rotationY: num(player.rotationY, 0),
    },
    settings: sanitizeSettings(source.settings),
    character: sanitizeCharacter(source.character),
    mission: {
      started: mission.started !== false,
      step,
      completed,
    },
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
        // A half-valid file is discarded so a corrupt save can never trap the
        // player in a broken world.
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
