import type { TeacherId } from "./teachers";

export type MessMealDifficulty = "easy" | "normal" | "hard";
export type MessMealStatus = "to-mess" | "return" | "caught" | "completed" | "failed" | "ended";

export interface MessMealCheckpoint {
  id: string;
  label: string;
  area: string;
  x: number;
  z: number;
  radius: number;
}

export interface MessMealDifficultyConfig {
  id: MessMealDifficulty;
  label: string;
  detail: string;
  detectionSpeed: number;
  detectionRadius: number;
  teacherSpeed: number;
  teachers: TeacherId[];
  checkpoints: string[];
}

/** The serving counter inside the real dining hall. */
export const MESS_MEAL_PICKUP = {
  x: -4,
  z: -42.2,
  label: "Meal from the serving counter",
};

export const MESS_MEAL_CHECKPOINTS: readonly MessMealCheckpoint[] = [
  {
    id: "assembly",
    label: "Cross the open assembly ground",
    area: "Assembly ground",
    x: 0,
    z: 4,
    radius: 5,
  },
  {
    id: "veranda",
    label: "Use the dining hall veranda",
    area: "Dining veranda",
    x: 2,
    z: -29.2,
    radius: 4,
  },
];

export const MESS_MEAL_DIFFICULTIES: Record<MessMealDifficulty, MessMealDifficultyConfig> = {
  easy: {
    id: "easy",
    label: "Easy",
    detail: "Five night staff · slower patrols · wider gaps · direct route",
    detectionSpeed: 0.55,
    detectionRadius: 0.8,
    teacherSpeed: 0.66,
    teachers: ["dinesh", "sushil", "ene", "sanathoi", "local"],
    checkpoints: [],
  },
  normal: {
    id: "normal",
    label: "Normal",
    detail: "Eight night staff · regular pace · dining veranda route",
    detectionSpeed: 1,
    detectionRadius: 1,
    teacherSpeed: 1,
    teachers: ["dinesh", "sushil", "rahul", "uma", "birjit", "ene", "sanathoi", "local"],
    checkpoints: ["veranda"],
  },
  hard: {
    id: "hard",
    label: "Hard",
    detail: "Full faculty · fast patrols · sharp eyes · assembly + veranda route",
    detectionSpeed: 1.75,
    detectionRadius: 1.16,
    teacherSpeed: 1.24,
    teachers: [
      "dinesh",
      "sushil",
      "rahul",
      "bobo",
      "uma",
      "sarjubala",
      "birjit",
      "lokeshori",
      "ene",
      "sanathoi",
      "local",
    ],
    checkpoints: ["assembly", "veranda"],
  },
};

export const MESS_MEAL_CAUGHT_LINE =
  "You! What are you doing here at this time? Report to the Principal's Chamber immediately!";

export const MESS_MEAL_CAUGHT_FOLLOW_UP =
  "I caught you sneaking around. You need to explain yourself to the Principal.";

export const MESS_MEAL_PRINCIPAL_OPENING =
  "Your teacher caught you sneaking around at night. I am Moinm Rahman, the Principal. Explain what you were doing outside your hostel.";

export const MESS_MEAL_PRINCIPAL_RESPONSES = [
  "I was trying to bring food for my roommates.",
  "I am sorry, Sir.",
  "I did not think it would cause a problem.",
] as const;

export const MESS_MEAL_ROOMMATE_LINES = {
  food: "Bro! You actually brought food! 😂",
  gather: "Come on, let's eat together!",
} as const;

export interface MessMealSave {
  active: boolean;
  difficulty: MessMealDifficulty;
  status: MessMealStatus;
  mealCollected: boolean;
  checkpointIds: string[];
  completedCheckpointIds: string[];
  suspicion: number;
  caughtBy: TeacherId | null;
  completedOnce: boolean;
  resultSeen: boolean;
}

export function emptyMessMealSave(): MessMealSave {
  return {
    active: false,
    difficulty: "normal",
    status: "to-mess",
    mealCollected: false,
    checkpointIds: [],
    completedCheckpointIds: [],
    suspicion: 0,
    caughtBy: null,
    completedOnce: false,
    resultSeen: true,
  };
}

export function messMealCheckpointsFor(
  difficulty: MessMealDifficulty,
  checkpointIds?: string[],
): MessMealCheckpoint[] {
  const config = MESS_MEAL_DIFFICULTIES[difficulty];
  const ids = checkpointIds && checkpointIds.length > 0 ? checkpointIds : config.checkpoints;
  return ids.flatMap((id) => {
    const checkpoint = MESS_MEAL_CHECKPOINTS.find((entry) => entry.id === id);
    return checkpoint ? [checkpoint] : [];
  });
}

export function isMessMealDifficulty(value: unknown): value is MessMealDifficulty {
  return value === "easy" || value === "normal" || value === "hard";
}
