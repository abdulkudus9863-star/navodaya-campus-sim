import type {
  TeacherAreaId,
  TeacherMemory,
  TeacherPersonalityId,
  TeacherSave,
  TimetablePhaseId,
} from "../core/types";

/**
 * Teacher roster configuration.
 *
 * Dinesh's strict Physical Education posting at the hostel is part of the
 * brief. Sushil and Rahul deliberately ship with neutral, fully editable
 * defaults: the game does not invent a personality, gender or patrol
 * preference for them. `configureTeacher` can replace these at runtime and
 * the choice is reflected in dialogue, animation and routes immediately.
 */
export type TeacherId = "dinesh" | "sushil" | "rahul";

export interface TeacherRoutePoint {
  x: number;
  z: number;
  pause?: number;
}

export interface TeacherAppearance {
  skin: string;
  hair: string;
  shirt: string;
  trousers: string;
  accents: string;
  build: "slim" | "regular" | "broad";
  height: number;
  glasses: boolean;
  beard: boolean;
  moustache: boolean;
  /** A whistle or lanyard reads instantly on the PE teacher. */
  whistle?: boolean;
  lanyard?: boolean;
}

export interface TeacherConfig {
  id: TeacherId;
  name: string;
  subject: string;
  gender: "male" | "female" | "unspecified";
  personality: TeacherPersonalityId;
  /** Neutral defaults for Sushil/Rahul; edit with configureTeacher(). */
  patrolAreas: TeacherAreaId[];
  speed: number;
  detectionRadius: number;
  approachRadius: number;
  appearance: TeacherAppearance;
  classNumber: string;
}

export interface TeacherRouteArea {
  id: TeacherAreaId;
  label: string;
  points: TeacherRoutePoint[];
}

export const TEACHER_ROUTES: Record<TeacherAreaId, TeacherRouteArea> = {
  hostel: {
    id: "hostel",
    label: "House hostels & south lawn",
    points: [
      { x: -6, z: 31.4, pause: 2.4 },
      { x: -17, z: 31.4, pause: 1.2 },
      { x: -27, z: 31.4, pause: 2.8 },
      { x: -38, z: 31.4, pause: 1.4 },
      { x: -47, z: 31.2, pause: 3.2 },
      { x: -36.5, z: 31.4, pause: 1.4 },
      { x: -27, z: 31.4, pause: 2.6 },
      { x: -18, z: 31.4, pause: 1.2 },
      { x: -10, z: 31.4, pause: 2.2 },
      { x: -2, z: 31.4, pause: 1.4 },
      { x: 7, z: 31.4, pause: 2.8 },
      { x: 15, z: 31.4, pause: 1.8 },
      { x: 19, z: 27, pause: 2.4 },
      { x: 12, z: 23.6, pause: 1.6 },
      { x: 4, z: 26.6, pause: 2 },
    ],
  },
  academic: {
    id: "academic",
    label: "Academic block & lawns",
    points: [
      { x: -14.8, z: 13.2, pause: 2.6 },
      { x: -23, z: 13.6, pause: 1.4 },
      { x: -34, z: 13.7, pause: 2.4 },
      { x: -44.2, z: 13.3, pause: 1.8 },
      { x: -46.6, z: 4, pause: 2.6 },
      { x: -46.2, z: -8, pause: 1.4 },
      { x: -44.5, z: -15.4, pause: 2.2 },
      { x: -34, z: -16.4, pause: 1.4 },
      { x: -24, z: -16.2, pause: 2.8 },
      { x: -17, z: -15.2, pause: 1.6 },
      { x: -14.7, z: -8, pause: 2.2 },
      { x: -14.5, z: -2, pause: 1.6 },
      { x: -14.7, z: 7.4, pause: 2.8 },
    ],
  },
  assembly: {
    id: "assembly",
    label: "Assembly ground",
    points: [
      { x: -11.4, z: 12.4, pause: 2.2 },
      { x: 0, z: 14, pause: 2.8 },
      { x: 11.4, z: 12.2, pause: 1.6 },
      { x: 12.4, z: 4, pause: 2.8 },
      { x: 11.6, z: -2.4, pause: 1.6 },
      { x: 4, z: -2.8, pause: 2.4 },
      { x: -4, z: -2.8, pause: 1.4 },
      { x: -11.8, z: -2.4, pause: 2.6 },
      { x: -12.2, z: 5, pause: 1.8 },
      { x: -6, z: 9.6, pause: 2 },
    ],
  },
  playground: {
    id: "playground",
    label: "Playground & sports ground",
    points: [
      { x: 24, z: 27.4, pause: 2.6 },
      { x: 33, z: 25.8, pause: 1.6 },
      { x: 44, z: 28.6, pause: 2.4 },
      { x: 48, z: 38, pause: 1.6 },
      { x: 44, z: 44, pause: 2.6 },
      { x: 33, z: 45, pause: 1.4 },
      { x: 24, z: 41, pause: 2.2 },
      { x: 22.8, z: 33, pause: 1.8 },
    ],
  },
  dining: {
    id: "dining",
    label: "Dining hall approach",
    points: [
      { x: -11.5, z: -28.8, pause: 2.4 },
      { x: -3, z: -28.2, pause: 1.4 },
      { x: 6, z: -28.4, pause: 2.6 },
      { x: 14.8, z: -28.8, pause: 1.6 },
      { x: 16.4, z: -34, pause: 2.2 },
      { x: 8, z: -30.4, pause: 1.4 },
      { x: -2, z: -31, pause: 2.6 },
      { x: -12, z: -31.6, pause: 1.8 },
    ],
  },
  entrance: {
    id: "entrance",
    label: "Main gate & administration",
    points: [
      { x: -4, z: 38.4, pause: 2.2 },
      { x: 4.5, z: 38.6, pause: 1.4 },
      { x: 5.4, z: 44.2, pause: 2.6 },
      { x: 3, z: 47.8, pause: 1.6 },
      { x: 0, z: 47.6, pause: 2.2 },
      { x: -5, z: 47.8, pause: 1.4 },
      { x: -7.2, z: 44.9, pause: 2.4 },
      { x: -7, z: 41.6, pause: 1.6 },
    ],
  },
  garden: {
    id: "garden",
    label: "Kitchen garden",
    points: [
      { x: -38, z: 31.2, pause: 2.2 },
      { x: -45.2, z: 31, pause: 1.6 },
      { x: -43, z: 25.8, pause: 2.4 },
      { x: -38.5, z: 23.6, pause: 1.4 },
      { x: -33.6, z: 25.4, pause: 2.2 },
      { x: -33.4, z: 30.2, pause: 1.6 },
    ],
  },
};

export const TEACHER_CONFIGS: Record<TeacherId, TeacherConfig> = {
  dinesh: {
    id: "dinesh",
    name: "Dinesh Sir",
    subject: "Physical Education",
    gender: "male",
    personality: "strict",
    patrolAreas: ["hostel"],
    speed: 1.28,
    detectionRadius: 8.2,
    approachRadius: 2.8,
    classNumber: "10",
    appearance: {
      skin: "#8a5a3c",
      hair: "#171412",
      shirt: "#263b2e",
      trousers: "#18251e",
      accents: "#c8813f",
      build: "broad",
      height: 1.14,
      glasses: false,
      beard: false,
      moustache: true,
      whistle: true,
    },
  },
  sushil: {
    id: "sushil",
    name: "Sushil Sir",
    subject: "Social Science",
    gender: "unspecified",
    personality: "neutral",
    // Neutral, editable default: no gender, personality or patrol preference
    // has been invented for this teacher.
    patrolAreas: ["academic"],
    speed: 1.08,
    detectionRadius: 7,
    approachRadius: 2.6,
    classNumber: "10",
    appearance: {
      skin: "#b57f56",
      hair: "#2b2521",
      shirt: "#c3d0d7",
      trousers: "#3d4650",
      accents: "#596f78",
      build: "slim",
      height: 1.08,
      glasses: true,
      beard: false,
      moustache: false,
      lanyard: true,
    },
  },
  rahul: {
    id: "rahul",
    name: "Rahul Sir",
    subject: "Economics",
    gender: "unspecified",
    personality: "neutral",
    // Neutral, editable default.
    patrolAreas: ["entrance", "assembly"],
    speed: 1.16,
    detectionRadius: 7.4,
    approachRadius: 2.6,
    classNumber: "10",
    appearance: {
      skin: "#9c6b4a",
      hair: "#201b19",
      shirt: "#e4ddcd",
      trousers: "#2b3039",
      accents: "#394d62",
      build: "regular",
      height: 1.11,
      glasses: false,
      beard: false,
      moustache: false,
      lanyard: true,
    },
  },
};

export const TEACHER_IDS: readonly TeacherId[] = ["dinesh", "sushil", "rahul"];

export const PERSONALITY_LABELS: Record<TeacherPersonalityId, string> = {
  strict: "Strict & bold",
  friendly: "Friendly",
  serious: "Serious",
  funny: "Funny",
  neutral: "Configurable baseline",
};

export const PERSONALITY_IDS: readonly TeacherPersonalityId[] = [
  "strict",
  "friendly",
  "serious",
  "funny",
  "neutral",
];

export const TEACHER_AREA_IDS: readonly TeacherAreaId[] = [
  "hostel",
  "academic",
  "playground",
  "dining",
  "entrance",
  "assembly",
  "garden",
];

export function isTeacherId(value: unknown): value is TeacherId {
  return typeof value === "string" && (TEACHER_IDS as readonly string[]).includes(value);
}

export function isTeacherPlace(value: unknown): value is TeacherAreaId {
  return typeof value === "string" && (TEACHER_AREA_IDS as readonly string[]).includes(value);
}

export function isTeacherPersonality(value: unknown): value is TeacherPersonalityId {
  return typeof value === "string" && (PERSONALITY_IDS as readonly string[]).includes(value);
}

export interface TimetablePeriod {
  id: TimetablePhaseId;
  label: string;
  startMinute: number;
  endMinute: number;
  allowedAreas: TeacherAreaId[];
  expectation: string;
}

/**
 * The campus day is accelerated for play: one game minute every two real
 * seconds. It starts at 16:00 so the first teachers are on games duty, then
 * moves through prep, dinner and hostel hours. `SchoolTimetableManager` can
 * also be pinned to a period for testing or a scripted school-day sequence.
 */
export const TIMETABLE: readonly TimetablePeriod[] = [
  {
    id: "assembly",
    label: "Morning assembly",
    startMinute: 6 * 60,
    endMinute: 8 * 60,
    allowedAreas: ["assembly", "hostel", "entrance"],
    expectation: "Everyone should be at assembly or moving back to the hostel.",
  },
  {
    id: "class",
    label: "Class hours",
    startMinute: 8 * 60,
    endMinute: 10 * 60 + 30,
    allowedAreas: ["academic"],
    expectation: "Students should be in the academic block unless they have a pass.",
  },
  {
    id: "break",
    label: "Short break",
    startMinute: 10 * 60 + 30,
    endMinute: 11 * 60,
    allowedAreas: ["assembly", "academic", "dining"],
    expectation: "Students may take a short break near the academic block or assembly ground.",
  },
  {
    id: "class",
    label: "Class hours",
    startMinute: 11 * 60,
    endMinute: 13 * 60,
    allowedAreas: ["academic"],
    expectation: "Students should be in class.",
  },
  {
    id: "lunch",
    label: "Lunch",
    startMinute: 13 * 60,
    endMinute: 14 * 60,
    allowedAreas: ["dining", "assembly", "hostel"],
    expectation: "Students may go to the dining hall or back towards the hostel.",
  },
  {
    id: "class",
    label: "Afternoon classes",
    startMinute: 14 * 60,
    endMinute: 16 * 60,
    allowedAreas: ["academic"],
    expectation: "Students should be in their afternoon class.",
  },
  {
    id: "games",
    label: "Games & co-curricular",
    startMinute: 16 * 60,
    endMinute: 18 * 60,
    allowedAreas: ["playground", "assembly", "garden", "hostel", "entrance"],
    expectation: "Students are expected on the playground or at a supervised activity.",
  },
  {
    id: "prep",
    label: "Evening prep",
    startMinute: 18 * 60,
    endMinute: 20 * 60,
    allowedAreas: ["academic", "hostel"],
    expectation: "Students should be at prep or in the house study room.",
  },
  {
    id: "dinner",
    label: "Dinner",
    startMinute: 20 * 60,
    endMinute: 21 * 60,
    allowedAreas: ["dining", "hostel", "assembly"],
    expectation: "Students should be at dinner or returning to the hostel.",
  },
  {
    id: "hostel",
    label: "Hostel hours",
    startMinute: 21 * 60,
    endMinute: 6 * 60,
    allowedAreas: ["hostel"],
    expectation: "Students should be in the house hostel after lights-out.",
  },
];

export function emptyTeacherMemory(): TeacherMemory {
  return {
    encounters: 0,
    warnings: 0,
    lastSeenAt: 0,
    lastQuestion: null,
    lastOutcome: null,
    history: [],
  };
}

export function emptyTeacherSave(): TeacherSave {
  return {
    reputation: 68,
    memories: {
      dinesh: emptyTeacherMemory(),
      sushil: emptyTeacherMemory(),
      rahul: emptyTeacherMemory(),
    },
    discipline: {
      active: false,
      teacherId: "dinesh",
      task: null,
      startedAt: 0,
      deadlineAt: 0,
    },
    cooldowns: {},
  };
}
