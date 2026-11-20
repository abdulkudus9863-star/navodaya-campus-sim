import type { TeacherConfig, TeacherId } from "../data/teachers";
import { TEACHER_CONFIGS } from "../data/teachers";
import { PERSONALITY_LABELS } from "../data/teachers";

/** Shared configuration for the standalone MESS RUN route. */
export type MessRunModeId = "classic" | "full-plate" | "teacher-challenge" | "delivery";
export type MessRunTeacherId = TeacherId | "principal";

export interface MessRunMode {
  id: MessRunModeId;
  name: string;
  kicker: string;
  description: string;
  objective: string;
  targetDistance: number | null;
  minimumFood: number;
  foodFailureAt: number;
  foodLossMultiplier: number;
  scoreMultiplier: number;
  teacherPressure: number;
  available: boolean;
}

export const MESS_RUN_MODES: readonly MessRunMode[] = [
  {
    id: "classic",
    name: "Classic Escape",
    kicker: "Endless",
    description: "Read the campus, weave the lanes and keep both trays level for as long as you can.",
    objective: "Survive. Protect both trays.",
    targetDistance: null,
    minimumFood: 0,
    foodFailureAt: 0,
    foodLossMultiplier: 1,
    scoreMultiplier: 1,
    teacherPressure: 1,
    available: true,
  },
  {
    id: "full-plate",
    name: "Full Plate",
    kicker: "Precision",
    description: "A longer escape with heavier spills. The trays must still look presentable at the finish.",
    objective: "Reach 700 m with at least 50% food.",
    targetDistance: 700,
    minimumFood: 50,
    foodFailureAt: 15,
    foodLossMultiplier: 1.28,
    scoreMultiplier: 1.15,
    teacherPressure: 1.03,
    available: true,
  },
  {
    id: "teacher-challenge",
    name: "Teacher Challenge",
    kicker: "Pressure",
    description: "Your chosen teacher is faster and less forgiving. Every spill brings them closer.",
    objective: "Outrun the selected teacher and build a score.",
    targetDistance: null,
    minimumFood: 0,
    foodFailureAt: 0,
    foodLossMultiplier: 1.08,
    scoreMultiplier: 1.3,
    teacherPressure: 1.22,
    available: true,
  },
  {
    id: "delivery",
    name: "Mess Delivery",
    kicker: "Objective",
    description: "Carry the trays across campus to the hostel table without arriving with empty dishes.",
    objective: "Deliver the food 650 m to the hostel.",
    targetDistance: 650,
    minimumFood: 35,
    foodFailureAt: 0,
    foodLossMultiplier: 1.06,
    scoreMultiplier: 1.2,
    teacherPressure: 1.06,
    available: true,
  },
] as const;

export const DEFAULT_MESS_RUN_MODE: MessRunModeId = "classic";

export type MessRunFoodKind = "chicken" | "fries" | "samosa" | "burger" | "coldDrink";

export interface MessRunCollectibles {
  chicken: number;
  fries: number;
  samosa: number;
  burger: number;
  coldDrink: number;
}

export const EMPTY_MESS_RUN_COLLECTIBLES: MessRunCollectibles = {
  chicken: 0,
  fries: 0,
  samosa: 0,
  burger: 0,
  coldDrink: 0,
};

/** Base points awarded by each distinct collectible. */
export const MESS_RUN_FOOD_POINTS: Record<MessRunFoodKind, number> = {
  chicken: 80,
  fries: 45,
  samosa: 25,
  burger: 35,
  coldDrink: 30,
};

export const MESS_RUN_FEAST_SIZE = 5;
export const MESS_RUN_FEAST_BONUS = 400;
export const MESS_RUN_BURGER_MULTIPLIER = 1.5;
export const MESS_RUN_BURGER_SECONDS = 12;
export const MESS_RUN_FEAST_MULTIPLIER = 1.75;
export const MESS_RUN_FEAST_SECONDS = 10;

export function collectibleBonusScore(
  collectibles: Partial<MessRunCollectibles> | null | undefined,
  chickenFeasts = 0,
): number {
  const safe = collectibles ?? EMPTY_MESS_RUN_COLLECTIBLES;
  return (
    Math.max(0, Math.floor(safe.chicken ?? 0)) * MESS_RUN_FOOD_POINTS.chicken +
    Math.max(0, Math.floor(safe.fries ?? 0)) * MESS_RUN_FOOD_POINTS.fries +
    Math.max(0, Math.floor(safe.samosa ?? 0)) * MESS_RUN_FOOD_POINTS.samosa +
    Math.max(0, Math.floor(safe.burger ?? 0)) * MESS_RUN_FOOD_POINTS.burger +
    Math.max(0, Math.floor(safe.coldDrink ?? 0)) * MESS_RUN_FOOD_POINTS.coldDrink +
    Math.max(0, Math.floor(chickenFeasts)) * MESS_RUN_FEAST_BONUS
  );
}

export function messRunMode(id: MessRunModeId): MessRunMode {
  return MESS_RUN_MODES.find((mode) => mode.id === id) ?? MESS_RUN_MODES[0];
}

export function isMessRunMode(id: string): id is MessRunModeId {
  return MESS_RUN_MODES.some((mode) => mode.id === id);
}

/**
 * Principal Moinm Rahman is an optional special chaser. The principal is not a
 * TeacherConfig in the campus engine, so this presentation-only config reuses
 * the existing adult rig and keeps the live campus NPC untouched.
 */
const PRINCIPAL_CHASER_CONFIG: TeacherConfig = {
  ...TEACHER_CONFIGS.rahul,
  id: "local",
  name: "Moinm Rahman",
  subject: "Principal",
  personality: "strict",
  appearance: {
    ...TEACHER_CONFIGS.rahul.appearance,
    shirt: "#d8d2c4",
    trousers: "#27312d",
    accents: "#d1ad63",
    build: "regular",
    height: 1.12,
    glasses: true,
    moustache: true,
    lanyard: true,
  },
};

export interface MessRunTeacher {
  id: MessRunTeacherId;
  name: string;
  role: string;
  subject: string;
  personalityLabel: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  difficultyLabel: string;
  intro: string;
  aggression: number;
  chaserConfig: TeacherConfig;
}

const TEACHER_PRESENTATION: Record<
  Exclude<TeacherId, "local">,
  {
    difficulty: 1 | 2 | 3 | 4 | 5;
    difficultyLabel: string;
    intro: string;
    aggression: number;
  }
> = {
  dinesh: {
    difficulty: 3,
    difficultyLabel: "Strict pace",
    intro: "“Stop there! We will discuss why you are running through the hostel with two trays.”",
    aggression: 1.08,
  },
  bobo: {
    difficulty: 2,
    difficultyLabel: "Campus chase",
    intro: "“A geography field exercise? Interesting. Let us see how well you know the campus.”",
    aggression: 0.9,
  },
  uma: {
    difficulty: 4,
    difficultyLabel: "No excuses",
    intro: "“Walk back here. The whole corridor can hear those plates rattling.”",
    aggression: 1.16,
  },
  sarjubala: {
    difficulty: 2,
    difficultyLabel: "Graceful pursuit",
    intro: "“A little balance would solve most of this. Come back and walk properly.”",
    aggression: 0.94,
  },
  sushil: {
    difficulty: 2,
    difficultyLabel: "Measured pursuit",
    intro: "“I only need a calm explanation. Stop running and give me one.”",
    aggression: 0.98,
  },
  rahul: {
    difficulty: 2,
    difficultyLabel: "Steady pursuit",
    intro: "“Consider the opportunity cost of dropping that lunch.”",
    aggression: 1,
  },
  birjit: {
    difficulty: 3,
    difficultyLabel: "Library silence",
    intro: "“No food beyond the library steps. You chose the wrong route.”",
    aggression: 1.05,
  },
  lokeshori: {
    difficulty: 5,
    difficultyLabel: "Relentless",
    intro: "“Good pace. Now try keeping it while carrying a full meal.”",
    aggression: 1.28,
  },
  ene: {
    difficulty: 1,
    difficultyLabel: "Playful chase",
    intro: "“Come back with those trays! That is tomorrow's breakfast too!”",
    aggression: 0.84,
  },
  sanathoi: {
    difficulty: 1,
    difficultyLabel: "Mess pursuit",
    intro: "“Two trays and no queue? At least give me a head start!”",
    aggression: 0.88,
  },
};

function teacherCard(id: Exclude<TeacherId, "local">): MessRunTeacher {
  const config = TEACHER_CONFIGS[id];
  const presentation = TEACHER_PRESENTATION[id];
  return {
    id,
    name: config.name.replace(/\s+Sir$/i, ""),
    role: id === "ene" || id === "sanathoi" ? "Mess staff" : "Teacher",
    subject: config.subject,
    personalityLabel: PERSONALITY_LABELS[config.personality],
    difficulty: presentation.difficulty,
    difficultyLabel: presentation.difficultyLabel,
    intro: presentation.intro,
    aggression: presentation.aggression,
    chaserConfig: config,
  };
}

const STANDARD_CHASERS: MessRunTeacher[] = (
  [
    "dinesh",
    "bobo",
    "uma",
    "sarjubala",
    "sushil",
    "rahul",
    "birjit",
    "lokeshori",
    "ene",
    "sanathoi",
  ] as const
).map(teacherCard);

export const PRINCIPAL_CHASER: MessRunTeacher = {
  id: "principal",
  name: "Moinm Rahman",
  role: "Principal",
  subject: "Administration",
  personalityLabel: "Formal",
  difficulty: 5,
  difficultyLabel: "Principal's special",
  intro: "“Principal's office. Now. Bring the trays; the evidence comes with you.”",
  aggression: 1.32,
  chaserConfig: PRINCIPAL_CHASER_CONFIG,
};

export const MESS_RUN_TEACHERS: readonly MessRunTeacher[] = [
  ...STANDARD_CHASERS,
  PRINCIPAL_CHASER,
] as const;

export const DEFAULT_MESS_RUN_TEACHER: MessRunTeacherId = "dinesh";

export function messRunTeacher(id: MessRunTeacherId): MessRunTeacher {
  return MESS_RUN_TEACHERS.find((teacher) => teacher.id === id) ?? MESS_RUN_TEACHERS[0];
}

export function isMessRunTeacherId(id: string): id is MessRunTeacherId {
  return MESS_RUN_TEACHERS.some((teacher) => teacher.id === id);
}

export interface MessRunResult {
  id: string;
  teacherId: MessRunTeacherId;
  teacherName: string;
  mode: MessRunModeId;
  outcome: "caught" | "empty" | "delivered";
  score: number;
  distance: number;
  durationMs: number;
  foodLeft: number;
  leftTray: number;
  rightTray: number;
  coins: number;
  nearMisses: number;
  obstaclesAvoided: number;
  collectibles: MessRunCollectibles;
  chickenFeasts: number;
  bestMultiplier: number;
  boostScore: number;
}

export interface MessRunStoredRun {
  at: number;
  teacherId: MessRunTeacherId;
  mode: MessRunModeId;
  score: number;
  distance: number;
  foodLeft: number;
  coins: number;
  durationMs: number;
  outcome: MessRunResult["outcome"];
}

export interface MessRunLocalStats {
  bestScore: number;
  runs: MessRunStoredRun[];
}

const STORAGE_KEY = "navodaya.messrun.v1";
const MAX_STORED_RUNS = 8;

export function readMessRunStats(): MessRunLocalStats {
  if (typeof window === "undefined") return { bestScore: 0, runs: [] };
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<MessRunLocalStats>
      | null;
    const runs = Array.isArray(raw?.runs)
      ? raw!.runs
          .filter(
            (run): run is MessRunStoredRun =>
              Boolean(run) &&
              typeof run.score === "number" &&
              isMessRunTeacherId(String(run.teacherId)) &&
              isMessRunMode(String(run.mode)),
          )
          .slice(0, MAX_STORED_RUNS)
          .map((run) => ({
            at: Math.max(0, Number(run.at) || 0),
            teacherId: run.teacherId,
            mode: run.mode,
            score: Math.max(0, Math.floor(run.score)),
            distance: Math.max(0, Number(run.distance) || 0),
            foodLeft: Math.max(0, Math.min(100, Number(run.foodLeft) || 0)),
            coins: Math.max(0, Math.floor(Number(run.coins) || 0)),
            durationMs: Math.max(0, Number(run.durationMs) || 0),
            outcome:
              run.outcome === "delivered" || run.outcome === "empty"
                ? (run.outcome as MessRunStoredRun["outcome"])
                : "caught",
          }))
      : [];
    const storedBest = Math.max(0, Math.floor(Number(raw?.bestScore) || 0));
    return {
      bestScore: Math.max(storedBest, ...runs.map((run) => run.score), 0),
      runs,
    };
  } catch {
    return { bestScore: 0, runs: [] };
  }
}

export function recordMessRunResult(result: MessRunResult): MessRunLocalStats {
  const previous = readMessRunStats();
  const run: MessRunStoredRun = {
    at: Date.now(),
    teacherId: result.teacherId,
    mode: result.mode,
    score: result.score,
    distance: result.distance,
    foodLeft: result.foodLeft,
    coins: result.coins,
    durationMs: result.durationMs,
    outcome: result.outcome,
  };
  const stats: MessRunLocalStats = {
    bestScore: Math.max(previous.bestScore, run.score),
    runs: [run, ...previous.runs].slice(0, MAX_STORED_RUNS),
  };
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
    } catch {
      // A blocked storage API must never stop the mini-game.
    }
  }
  return stats;
}

/** Shared client/server score formula; the server recomputes it independently. */
export function computeMessRunScore(input: {
  distance: number;
  foodLeft: number;
  coins: number;
  nearMisses: number;
  mode: MessRunModeId;
  collectibles?: Partial<MessRunCollectibles> | null;
  chickenFeasts?: number;
  boostScore?: number;
}): number {
  const mode = messRunMode(input.mode);
  const distance = Math.max(0, input.distance);
  const food = Math.max(0, Math.min(100, input.foodLeft));
  const coins = Math.max(0, Math.min(100_000, Math.floor(input.coins)));
  const nearMisses = Math.max(0, Math.min(100_000, Math.floor(input.nearMisses)));
  const collectibleBonus = collectibleBonusScore(input.collectibles, input.chickenFeasts ?? 0);
  const boostScore = Math.max(0, Math.min(50_000, Math.floor(input.boostScore ?? 0)));
  return Math.floor(
    (distance * 2 + food * 12 + coins * 25 + nearMisses * 15 + collectibleBonus + boostScore) *
      mode.scoreMultiplier,
  );
}

export function formatMessRunDistance(distance: number): string {
  return `${Math.max(0, Math.round(distance)).toLocaleString()} m`;
}

export function formatMessRunScore(score: number): string {
  return Math.max(0, Math.round(score)).toLocaleString();
}

export function formatMessRunTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatStoredRunDate(timestamp: number): string {
  try {
    return new Intl.DateTimeFormat("en", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch {
    return "Previous run";
  }
}
