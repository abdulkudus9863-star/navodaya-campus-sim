import type { TeacherId } from "./teachers";

export type ClassBunkDifficulty = "easy" | "normal" | "hard";
export type ClassBunkStatus = "exploring" | "return" | "caught" | "completed" | "failed" | "ended";

export interface ClassBunkObjective {
  id: string;
  label: string;
  area: string;
  x: number;
  z: number;
  radius: number;
}

export interface ClassBunkDifficultyConfig {
  id: ClassBunkDifficulty;
  label: string;
  detail: string;
  seconds: number;
  objectiveCount: number;
  detectionSpeed: number;
  detectionRadius: number;
  teachers: TeacherId[];
}

/**
 * Real Room 101 ground-floor classroom. The door opening is on the north wall,
 * so the student starts facing it and can step straight into the corridor.
 */
export const CLASS_BUNK_START = { x: -31.3, z: -4.5, rotation: 0 };
export const CLASS_BUNK_RETURN = { x: -31.1, z: -3.8, radius: 2.6 };

export const CLASS_BUNK_OBJECTIVES: readonly ClassBunkObjective[] = [
  {
    id: "playground",
    label: "Cross the playground",
    area: "Playground",
    x: 32,
    z: 30,
    radius: 5.5,
  },
  {
    id: "hostel",
    label: "Slip past the hostel courtyard",
    area: "Hostel courtyard",
    x: -18,
    z: 31.4,
    radius: 4.6,
  },
  {
    id: "library",
    label: "Circle the library",
    area: "Library surroundings",
    x: -26,
    z: -30,
    radius: 4.4,
  },
  {
    id: "corridor",
    label: "Walk the academic corridor",
    area: "Academic corridors",
    x: -30,
    z: 0,
    radius: 4,
  },
  {
    id: "garden",
    label: "Cut through the school garden",
    area: "School garden",
    x: -38,
    z: 26,
    radius: 4.2,
  },
  {
    id: "dining",
    label: "Peek into the dining hall",
    area: "Dining hall approach",
    x: 2,
    z: -30,
    radius: 4.4,
  },
];

export const CLASS_BUNK_DIFFICULTIES: Record<ClassBunkDifficulty, ClassBunkDifficultyConfig> = {
  easy: {
    id: "easy",
    label: "Easy",
    detail: "Fewer staff on duty · slower eyes · four stops",
    seconds: 300,
    objectiveCount: 4,
    detectionSpeed: 0.58,
    detectionRadius: 0.82,
    teachers: ["dinesh", "sushil", "bobo", "sarjubala", "ene", "sanathoi"],
  },
  normal: {
    id: "normal",
    label: "Normal",
    detail: "Standard patrols · five stops",
    seconds: 240,
    objectiveCount: 5,
    detectionSpeed: 1,
    detectionRadius: 1,
    teachers: [
      "dinesh",
      "sushil",
      "rahul",
      "bobo",
      "uma",
      "birjit",
      "ene",
      "sanathoi",
      "local",
    ],
  },
  hard: {
    id: "hard",
    label: "Hard",
    detail: "Full faculty · sharp eyes · all six stops",
    seconds: 195,
    objectiveCount: 6,
    detectionSpeed: 1.7,
    detectionRadius: 1.18,
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
  },
};

export const CLASS_BUNK_CAUGHT_LINE =
  "Why are you not in your classroom? Report to the Principal's Chamber immediately!";

export interface ClassBunkSave {
  active: boolean;
  difficulty: ClassBunkDifficulty;
  objectiveIds: string[];
  completedIds: string[];
  remaining: number;
  suspicion: number;
  status: ClassBunkStatus;
  caughtBy: TeacherId | null;
  completedOnce: boolean;
  resultSeen: boolean;
}

export function emptyClassBunkSave(): ClassBunkSave {
  return {
    active: false,
    difficulty: "normal",
    objectiveIds: [],
    completedIds: [],
    remaining: 0,
    suspicion: 0,
    status: "exploring",
    caughtBy: null,
    completedOnce: false,
    resultSeen: true,
  };
}

export function classBunkObjectivesFor(
  difficulty: ClassBunkDifficulty,
  objectiveIds?: string[],
): ClassBunkObjective[] {
  const config = CLASS_BUNK_DIFFICULTIES[difficulty];
  if (objectiveIds && objectiveIds.length > 0) {
    return objectiveIds.flatMap((id) => {
      const objective = CLASS_BUNK_OBJECTIVES.find((entry) => entry.id === id);
      return objective ? [objective] : [];
    });
  }
  return CLASS_BUNK_OBJECTIVES.slice(0, config.objectiveCount);
}

export function isClassBunkDifficulty(value: unknown): value is ClassBunkDifficulty {
  return value === "easy" || value === "normal" || value === "hard";
}
