/**
 * Campus Escape course data, scoring and save validation.
 *
 * The course is a fictional obstacle challenge laid out on the sports side of
 * the campus. It is not a survey of the real school and does not depict entry
 * into restricted buildings. All progress is local and player-scoped through
 * the main save file; no house points are awarded here.
 */

export type EscapeDifficulty = "easy" | "normal" | "hard";
export type EscapeLevelId = "playground-dash" | "academic-run" | "hostel-challenge";

export type EscapeObstacleKind =
  | "hurdle"
  | "cone"
  | "barrier"
  | "block"
  | "gap"
  | "sweeper"
  | "platform"
  | "narrow";

export interface EscapeObstacle {
  id: string;
  kind: EscapeObstacleKind;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  /** Lateral movement in metres for moving obstacles. */
  moveAmp: number;
  moveSpeed: number;
  phase: number;
}

export interface EscapeToken {
  id: string;
  x: number;
  z: number;
  y: number;
}

export interface EscapeCheckpoint {
  index: number;
  x: number;
  z: number;
}

export interface EscapeCourse {
  levelId: EscapeLevelId;
  difficulty: EscapeDifficulty;
  length: number;
  timer: number;
  targetTime: number;
  obstacles: EscapeObstacle[];
  tokens: EscapeToken[];
  checkpoints: EscapeCheckpoint[];
}

export interface EscapeLevelDefinition {
  id: EscapeLevelId;
  number: number;
  name: string;
  location: string;
  difficultyLabel: string;
  description: string;
  objective: string;
  length: number;
  baseTimer: number;
  targetTime: number;
  tokenCount: number;
  obstacleCounts: Record<EscapeDifficulty, number>;
  checkpointCounts: Record<EscapeDifficulty, number>;
  accent: string;
  ground: string;
  sky: string;
}

export const ESCAPE_DIFFICULTIES: readonly EscapeDifficulty[] = ["easy", "normal", "hard"];

export const ESCAPE_DIFFICULTY_LABELS: Record<EscapeDifficulty, string> = {
  easy: "Easy",
  normal: "Normal",
  hard: "Hard",
};

export const ESCAPE_DIFFICULTY_NOTES: Record<EscapeDifficulty, string> = {
  easy: "Longer timer · fewer obstacles · more checkpoints",
  normal: "Standard timer · balanced hazards · standard checkpoints",
  hard: "Shorter timer · more hazards · fewer checkpoints",
};

export const ESCAPE_LEVELS: readonly EscapeLevelDefinition[] = [
  {
    id: "playground-dash",
    number: 1,
    name: "Playground Dash",
    location: "Sports ground · running track",
    difficultyLabel: "Easy course",
    description:
      "A warm-up lap around the running track. Clear low hurdles, dodge practice cones and collect energy tokens before the finish line.",
    objective: "Reach the finish line",
    length: 170,
    baseTimer: 84,
    targetTime: 52,
    tokenCount: 8,
    obstacleCounts: { easy: 9, normal: 13, hard: 17 },
    checkpointCounts: { easy: 3, normal: 2, hard: 1 },
    accent: "#d9b56d",
    ground: "#4f5c38",
    sky: "#243229",
  },
  {
    id: "academic-run",
    number: 2,
    name: "Academic Block Run",
    location: "Academic lawns · garden paths",
    difficultyLabel: "Medium course",
    description:
      "A flowing route along the outer academic lawns. Time your jumps over moving platforms, thread the narrow passages and keep moving.",
    objective: "Cross the academic lawns",
    length: 210,
    baseTimer: 96,
    targetTime: 60,
    tokenCount: 10,
    obstacleCounts: { easy: 12, normal: 17, hard: 22 },
    checkpointCounts: { easy: 3, normal: 2, hard: 1 },
    accent: "#9fc38d",
    ground: "#46543b",
    sky: "#21302b",
  },
  {
    id: "hostel-challenge",
    number: 3,
    name: "Hostel Challenge",
    location: "Hostel recreation ground",
    difficultyLabel: "Hard course",
    description:
      "The final test on the fictional recreation ground. Zigzag through sweepers, clear longer jumps and hold your nerve through the timed finish.",
    objective: "Complete the final challenge",
    length: 250,
    baseTimer: 112,
    targetTime: 72,
    tokenCount: 12,
    obstacleCounts: { easy: 15, normal: 21, hard: 27 },
    checkpointCounts: { easy: 4, normal: 3, hard: 2 },
    accent: "#d99b84",
    ground: "#4a4438",
    sky: "#2a2420",
  },
] as const;

export const ESCAPE_LEVEL_IDS = ESCAPE_LEVELS.map((level) => level.id);

export function isEscapeDifficulty(value: unknown): value is EscapeDifficulty {
  return typeof value === "string" && ESCAPE_DIFFICULTIES.includes(value as EscapeDifficulty);
}

export function isEscapeLevelId(value: unknown): value is EscapeLevelId {
  return typeof value === "string" && ESCAPE_LEVEL_IDS.includes(value as EscapeLevelId);
}

export function getEscapeLevel(id: string | null | undefined): EscapeLevelDefinition | undefined {
  return ESCAPE_LEVELS.find((level) => level.id === id);
}

const TIMER_MULTIPLIER: Record<EscapeDifficulty, number> = {
  easy: 1.25,
  normal: 1,
  hard: 0.8,
};

/** Deterministic but level-specific layouts, so a course always plays the same. */
export function buildEscapeCourse(
  levelId: EscapeLevelId,
  difficulty: EscapeDifficulty,
): EscapeCourse {
  const level = getEscapeLevel(levelId) ?? ESCAPE_LEVELS[0];
  const count = level.obstacleCounts[difficulty];
  const checkpointCount = level.checkpointCounts[difficulty];
  const startX = 16;
  const finishX = level.length;
  const usable = finishX - startX - 12;

  const obstacles: EscapeObstacle[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    const x = startX + usable * (0.08 + t * 0.86) + ((i * 7) % 5) - 2;
    const lane = [-1.45, 0, 1.45][(i + level.number) % 3];
    const kind = pickKind(level.id, i);
    const moving = kind === "sweeper" || (kind === "platform" && i % 2 === 0);
    obstacles.push({
      id: `${level.id}-${difficulty}-o${i}`,
      kind,
      x,
      z: kind === "narrow" ? 0 : lane,
      width:
        kind === "gap" ? 2.6 : kind === "narrow" ? 1.1 : kind === "sweeper" ? 2.6 : 1.5,
      depth:
        kind === "gap" ? 2.4 : kind === "narrow" ? 2.2 : kind === "barrier" ? 0.45 : 1.25,
      height:
        kind === "hurdle"
          ? 0.58
          : kind === "cone"
            ? 0.62
            : kind === "barrier"
              ? 1.05
              : kind === "block"
                ? 1.3
                : kind === "platform"
                  ? 0.62
                  : kind === "narrow"
                    ? 1.8
                    : 0,
      moveAmp: moving ? (kind === "sweeper" ? 1.75 : 0.95) : 0,
      moveSpeed: moving ? 1.1 + (i % 3) * 0.28 : 0,
      phase: (i * 1.37) % (Math.PI * 2),
    });
  }

  const tokens: EscapeToken[] = [];
  for (let i = 0; i < level.tokenCount; i += 1) {
    const t = level.tokenCount === 1 ? 0.5 : i / (level.tokenCount - 1);
    tokens.push({
      id: `${level.id}-${difficulty}-t${i}`,
      x: startX - 4 + (finishX - startX) * t,
      z: [-1.9, 0, 1.9, 0.95, -0.95][(i + level.number) % 5],
      y: 1.15 + ((i + level.number) % 2) * 0.45,
    });
  }

  const checkpoints: EscapeCheckpoint[] = [];
  for (let i = 0; i < checkpointCount; i += 1) {
    checkpoints.push({
      index: i,
      x: startX + ((finishX - startX) * (i + 1)) / (checkpointCount + 1),
      z: 0,
    });
  }

  return {
    levelId: level.id,
    difficulty,
    length: level.length,
    timer: Math.round(level.baseTimer * TIMER_MULTIPLIER[difficulty]),
    targetTime: level.targetTime,
    obstacles,
    tokens,
    checkpoints,
  };
}

function pickKind(levelId: EscapeLevelId, index: number): EscapeObstacleKind {
  if (levelId === "playground-dash") {
    return (["hurdle", "cone", "barrier", "hurdle", "cone"] as const)[index % 5];
  }
  if (levelId === "academic-run") {
    return (["hurdle", "platform", "narrow", "gap", "cone", "block"] as const)[index % 6];
  }
  return (["sweeper", "hurdle", "gap", "platform", "barrier", "cone", "narrow"] as const)[
    index % 7
  ];
}

export interface EscapeRunResult {
  levelId: EscapeLevelId;
  difficulty: EscapeDifficulty;
  completed: boolean;
  elapsed: number;
  tokens: number;
  totalTokens: number;
  checkpoints: number;
  totalCheckpoints: number;
  collisions: number;
  falls: number;
  completionScore: number;
  tokenScore: number;
  checkpointScore: number;
  timeBonus: number;
  penalty: number;
  score: number;
  targetTime: number;
}

export interface EscapeScoreInput {
  course: EscapeCourse;
  completed: boolean;
  elapsed: number;
  tokens: number;
  checkpoints: number;
  collisions: number;
  falls: number;
}

/** Transparent, clamped scoring. Nothing here touches official house points. */
export function calculateEscapeScore(input: EscapeScoreInput): EscapeRunResult {
  const { course } = input;
  const completed = input.completed;
  const elapsed = Math.max(0, Math.min(input.elapsed, course.timer));
  const tokens = Math.max(0, Math.min(Math.floor(input.tokens), course.tokens.length));
  const checkpoints = Math.max(0, Math.min(Math.floor(input.checkpoints), course.checkpoints.length));
  const collisions = Math.max(0, Math.floor(input.collisions));
  const falls = Math.max(0, Math.floor(input.falls));

  const completionScore = completed ? 500 : 0;
  const tokenScore = tokens * 20;
  const checkpointScore = checkpoints * 50;
  const remaining = completed ? Math.max(0, course.timer - elapsed) : 0;
  const timeBonus = completed ? Math.min(200, Math.round((remaining / course.timer) * 200)) : 0;
  const penalty = collisions * 10 + falls * 20;
  const score = Math.max(0, completionScore + tokenScore + checkpointScore + timeBonus - penalty);

  return {
    levelId: course.levelId,
    difficulty: course.difficulty,
    completed,
    elapsed,
    tokens,
    totalTokens: course.tokens.length,
    checkpoints,
    totalCheckpoints: course.checkpoints.length,
    collisions,
    falls,
    completionScore,
    tokenScore,
    checkpointScore,
    timeBonus,
    penalty,
    score,
    targetTime: course.targetTime,
  };
}

/* ------------------------------------------------------------------ records */

export interface EscapeRecord {
  levelId: EscapeLevelId;
  difficulty: EscapeDifficulty;
  bestScore: number;
  bestTime: number;
  completions: number;
  updatedAt: number;
}

export interface EscapeCheckpointSave {
  levelId: EscapeLevelId;
  difficulty: EscapeDifficulty;
  checkpointIndex: number;
  x: number;
  elapsed: number;
  tokens: string[];
  collisions: number;
  falls: number;
  savedAt: number;
}

export interface EscapeSave {
  playerId: string;
  difficulty: EscapeDifficulty;
  lastLevelId: EscapeLevelId;
  records: EscapeRecord[];
  achievements: string[];
  checkpoint: EscapeCheckpointSave | null;
}

export interface EscapeRecordView extends EscapeRecord {
  levelName: string;
}

export const ESCAPE_ACHIEVEMENT_IDS = [
  "escape-first-run",
  "escape-collector",
  "escape-perfect",
  "escape-speed",
  "escape-champion",
] as const;

export type EscapeAchievementId = (typeof ESCAPE_ACHIEVEMENT_IDS)[number];

export const ESCAPE_ACHIEVEMENT_NAMES: Record<EscapeAchievementId, string> = {
  "escape-first-run": "First Run",
  "escape-collector": "Collector",
  "escape-perfect": "Perfect Run",
  "escape-speed": "Speed Runner",
  "escape-champion": "Campus Champion",
};

export function isEscapeAchievementId(value: unknown): value is EscapeAchievementId {
  return typeof value === "string" && (ESCAPE_ACHIEVEMENT_IDS as readonly string[]).includes(value);
}

export function emptyEscapeSave(playerId: string): EscapeSave {
  return {
    playerId,
    difficulty: "normal",
    lastLevelId: "playground-dash",
    records: [],
    achievements: [],
    checkpoint: null,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function escapeRecordKey(levelId: EscapeLevelId, difficulty: EscapeDifficulty): string {
  return `${levelId}:${difficulty}`;
}

/** Validates local escape data against the owning profile. Never trusts scores blindly. */
export function sanitizeEscape(raw: unknown, playerId: string): EscapeSave {
  const fallback = emptyEscapeSave(playerId);
  if (!raw || typeof raw !== "object") return fallback;
  const source = raw as Record<string, unknown>;
  if (source.playerId !== playerId) return fallback;

  const difficulty = isEscapeDifficulty(source.difficulty) ? source.difficulty : fallback.difficulty;
  const lastLevelId = isEscapeLevelId(source.lastLevelId)
    ? source.lastLevelId
    : fallback.lastLevelId;

  const records: EscapeRecord[] = [];
  const rawRecords = Array.isArray(source.records) ? source.records : [];
  for (const item of rawRecords.slice(0, 32)) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (!isEscapeLevelId(record.levelId) || !isEscapeDifficulty(record.difficulty)) continue;
    const bestScore = isFiniteNumber(record.bestScore)
      ? clamp(Math.floor(record.bestScore), 0, 100_000)
      : 0;
    const bestTime = isFiniteNumber(record.bestTime)
      ? clamp(record.bestTime, 0, 3_600)
      : 3_600;
    if (bestScore <= 0 || bestTime >= 3_600) continue;
    const key = escapeRecordKey(record.levelId, record.difficulty);
    if (records.some((existing) => escapeRecordKey(existing.levelId, existing.difficulty) === key)) {
      continue;
    }
    records.push({
      levelId: record.levelId,
      difficulty: record.difficulty,
      bestScore,
      bestTime: Math.round(bestTime * 10) / 10,
      completions: isFiniteNumber(record.completions)
        ? clamp(Math.floor(record.completions), 1, 10_000)
        : 1,
      updatedAt: isFiniteNumber(record.updatedAt)
        ? clamp(Math.floor(record.updatedAt), 0, 8_640_000_000_000_000)
        : 0,
    });
  }

  const achievements = Array.isArray(source.achievements)
    ? Array.from(new Set(source.achievements.filter(isEscapeAchievementId)))
    : [];

  let checkpoint: EscapeCheckpointSave | null = null;
  const rawCheckpoint = source.checkpoint as Record<string, unknown> | null | undefined;
  if (rawCheckpoint && typeof rawCheckpoint === "object") {
    if (
      isEscapeLevelId(rawCheckpoint.levelId) &&
      isEscapeDifficulty(rawCheckpoint.difficulty) &&
      isFiniteNumber(rawCheckpoint.checkpointIndex) &&
      isFiniteNumber(rawCheckpoint.x) &&
      isFiniteNumber(rawCheckpoint.elapsed)
    ) {
      const level = getEscapeLevel(rawCheckpoint.levelId);
      const course = buildEscapeCourse(rawCheckpoint.levelId, rawCheckpoint.difficulty);
      const index = clamp(
        Math.floor(rawCheckpoint.checkpointIndex),
        0,
        Math.max(0, course.checkpoints.length - 1),
      );
      if (level && course.checkpoints.length > 0) {
        checkpoint = {
          levelId: rawCheckpoint.levelId,
          difficulty: rawCheckpoint.difficulty,
          checkpointIndex: index,
          x: clamp(rawCheckpoint.x, 0, level.length),
          elapsed: clamp(rawCheckpoint.elapsed, 0, course.timer),
          tokens: Array.isArray(rawCheckpoint.tokens)
            ? rawCheckpoint.tokens.filter(
                (id): id is string => typeof id === "string" && course.tokens.some((t) => t.id === id),
              )
            : [],
          collisions: isFiniteNumber(rawCheckpoint.collisions)
            ? clamp(Math.floor(rawCheckpoint.collisions), 0, 999)
            : 0,
          falls: isFiniteNumber(rawCheckpoint.falls)
            ? clamp(Math.floor(rawCheckpoint.falls), 0, 999)
            : 0,
          savedAt: isFiniteNumber(rawCheckpoint.savedAt)
            ? clamp(Math.floor(rawCheckpoint.savedAt), 0, 8_640_000_000_000_000)
            : 0,
        };
      }
    }
  }

  return { playerId, difficulty, lastLevelId, records, achievements, checkpoint };
}

export function getEscapeRecord(
  save: EscapeSave,
  levelId: EscapeLevelId,
  difficulty: EscapeDifficulty,
): EscapeRecord | undefined {
  return save.records.find(
    (record) => record.levelId === levelId && record.difficulty === difficulty,
  );
}

export function totalEscapeXp(save: EscapeSave): number {
  return save.records.reduce((total, record) => total + record.bestScore, 0);
}

export function escapeLevelNumber(save: EscapeSave): number {
  return 1 + Math.floor(totalEscapeXp(save) / 500);
}

export function isEscapeLevelUnlocked(save: EscapeSave, levelId: EscapeLevelId): boolean {
  const level = getEscapeLevel(levelId);
  if (!level) return false;
  if (level.number === 1) return true;
  const previous = ESCAPE_LEVELS.find((item) => item.number === level.number - 1);
  return Boolean(previous && save.records.some((record) => record.levelId === previous.id));
}

export function bestEscapeRecord(save: EscapeSave): EscapeRecord | undefined {
  return [...save.records].sort(
    (a, b) =>
      b.bestScore - a.bestScore ||
      a.bestTime - b.bestTime ||
      b.updatedAt - a.updatedAt,
  )[0];
}

export function escapeRecordViews(save: EscapeSave): EscapeRecordView[] {
  return save.records
    .map((record) => ({
      ...record,
      levelName: getEscapeLevel(record.levelId)?.name ?? record.levelId,
    }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

/** One achievement object per completed run; each is only awarded once. */
export function escapeAchievementsForRun(input: {
  result: EscapeRunResult;
  completedLevels: number;
}): EscapeAchievementId[] {
  if (!input.result.completed) return [];
  const awards: EscapeAchievementId[] = ["escape-first-run"];
  if (input.result.tokens >= input.result.totalTokens) awards.push("escape-collector");
  if (input.result.falls === 0 && input.result.collisions === 0) awards.push("escape-perfect");
  if (input.result.elapsed <= input.result.targetTime) awards.push("escape-speed");
  if (input.completedLevels >= ESCAPE_LEVELS.length) awards.push("escape-champion");
  return awards;
}

export function formatEscapeTime(seconds: number): string {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, "0")}`;
}
