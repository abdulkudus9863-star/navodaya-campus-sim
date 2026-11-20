import type { TeacherAreaId, TeacherPersonalityId, TimetablePhaseId } from "../core/types";
import { PRINCIPAL } from "../data/principal";
import {
  TEACHER_CONFIGS,
  TEACHER_IDS,
  type TeacherConfig,
  type TeacherId,
} from "../data/teachers";

/**
 * Central, read-only NPC roster.
 *
 * The live actors are still the existing TeacherNPCController instances, the
 * authored Principal and Meera. This registry gives every one of them the same
 * profile shape so prompts, schedules, dialogue and future authoring tools can
 * address them through one contract without duplicating a character.
 */
export type NpcKind = "principal" | "teacher" | "mess" | "student" | "support";

export type NpcActivityId =
  | "idle"
  | "walking"
  | "patrolling"
  | "teaching"
  | "talking"
  | "working"
  | "eating"
  | "observing"
  | "interacting"
  | "returning";

export type NpcPersonalityId = TeacherPersonalityId | "formal";

export type NpcId = `teacher:${TeacherId}` | "principal" | "student:meera";

export interface NpcAppearance {
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
}

export interface NpcScheduleEntry {
  phase: TimetablePhaseId;
  activity: NpcActivityId;
  area: string;
  label: string;
}

export interface NpcDialogueProfile {
  id: string;
  style: "teacher-authored" | "principal-authored" | "student-authored";
  tone: NpcPersonalityId;
  usesAuthenticatedName: boolean;
}

export interface NpcInteractionRules {
  radius: number;
  requiresLineOfSight: boolean;
  allowDuringDialogue: boolean;
  cooldownSeconds: number;
}

export interface NpcProfile {
  npcId: NpcId;
  name: string;
  role: string;
  gender: "male" | "female" | "unspecified";
  subject: string;
  personality: NpcPersonalityId;
  appearance: NpcAppearance;
  characterModel: string;
  animationSet: string[];
  patrolArea: string;
  dailySchedule: NpcScheduleEntry[];
  currentActivity: NpcActivityId;
  dialogueProfile: NpcDialogueProfile;
  interactionRules: NpcInteractionRules;
  missionReferences: string[];
  activeStatus: boolean;
  kind: NpcKind;
  teacherId?: TeacherId;
}

const PHASES: TimetablePhaseId[] = [
  "assembly",
  "class",
  "break",
  "lunch",
  "games",
  "prep",
  "dinner",
  "hostel",
];

const TEACHER_ANIMATIONS = [
  "idle",
  "walk",
  "notice",
  "talk",
  "gesture",
  "turn-to-player",
  "return-to-patrol",
];

const MESS_ANIMATIONS = ["idle", "walk", "work", "talk", "gesture", "turn-to-player"];

interface TeacherNpcMeta {
  name: string;
  role: string;
  subject?: string;
  patrolArea: string;
  missionReferences: string[];
  kind: NpcKind;
}

const TEACHER_META: Record<TeacherId, TeacherNpcMeta> = {
  bobo: {
    name: "Bobo",
    role: "Teacher",
    patrolArea: "Entire campus & classrooms",
    missionReferences: [],
    kind: "teacher",
  },
  uma: {
    name: "Uma",
    role: "Teacher",
    patrolArea: "Entire campus",
    missionReferences: [],
    kind: "teacher",
  },
  sarjubala: {
    name: "Sarjubala",
    role: "Teacher",
    patrolArea: "Anywhere on campus",
    missionReferences: [],
    kind: "teacher",
  },
  birjit: {
    name: "Birjit",
    role: "Librarian",
    subject: "Library",
    patrolArea: "Academic block & library",
    missionReferences: [],
    kind: "teacher",
  },
  lokeshori: {
    name: "Lokeshori",
    role: "Teacher",
    patrolArea: "Entire campus",
    missionReferences: [],
    kind: "teacher",
  },
  dinesh: {
    name: "Dinesh",
    role: "Teacher",
    patrolArea: "Hostel area",
    missionReferences: [],
    kind: "teacher",
  },
  ene: {
    name: "Ene",
    role: "Mess staff",
    subject: "Mess",
    patrolArea: "Mess",
    missionReferences: [],
    kind: "mess",
  },
  sanathoi: {
    name: "Sanathoi",
    role: "Mess staff",
    subject: "Mess",
    patrolArea: "Mess",
    missionReferences: [],
    kind: "mess",
  },
  sushil: {
    name: "Sushil",
    role: "Teacher",
    // Existing authored route only; no personality or appearance details are invented.
    patrolArea: "Academic block & lawns",
    missionReferences: [],
    kind: "teacher",
  },
  rahul: {
    name: "Rahul",
    role: "Teacher",
    patrolArea: "Main gate, administration & assembly ground",
    missionReferences: [],
    kind: "teacher",
  },
  local: {
    name: "Local",
    role: "Support staff",
    patrolArea: "Playground & main gate",
    missionReferences: [],
    kind: "support",
  },
};

function tightSchedule(area: string): NpcScheduleEntry[] {
  return [
    { phase: "assembly", activity: "observing", area: "Assembly ground", label: "Assembly supervision" },
    { phase: "class", activity: "teaching", area: "Academic block", label: "Class hours" },
    { phase: "break", activity: "observing", area, label: "Break duty" },
    { phase: "lunch", activity: "eating", area: "Dining hall", label: "Lunch" },
    { phase: "games", activity: "observing", area: "Playground & campus", label: "Games duty" },
    { phase: "prep", activity: "teaching", area: "Academic block or hostel prep room", label: "Evening prep" },
    { phase: "dinner", activity: "eating", area: "Dining hall", label: "Dinner" },
    { phase: "hostel", activity: "patrolling", area: "House hostels", label: "Hostel rounds" },
  ];
}

function messSchedule(): NpcScheduleEntry[] {
  return PHASES.map((phase) => {
    const meal = phase === "lunch" || phase === "dinner";
    const resting = phase === "hostel";
    return {
      phase,
      activity: resting ? "idle" : "working",
      area: "Mess & dining hall",
      label: resting ? "End of shift" : meal ? "Serving the meal" : "Kitchen and mess work",
    };
  });
}

function supportSchedule(area: string): NpcScheduleEntry[] {
  return PHASES.map((phase) => {
    if (phase === "lunch" || phase === "dinner") {
      return { phase, activity: "eating", area: "Dining hall", label: "Meal break" };
    }
    if (phase === "hostel") {
      return { phase, activity: "patrolling", area, label: "Evening campus round" };
    }
    if (phase === "assembly") {
      return { phase, activity: "observing", area: "Assembly ground", label: "Assembly duty" };
    }
    return { phase, activity: "working", area, label: "Campus maintenance" };
  });
}

function principalSchedule(): NpcScheduleEntry[] {
  return PHASES.map((phase) => ({
    phase,
    activity: phase === "lunch" || phase === "dinner" ? "eating" : "working",
    area: PRINCIPAL.chamberName,
    label: phase === "lunch" || phase === "dinner" ? "Meal break" : "Administrative duty",
  }));
}

function studentSchedule(): NpcScheduleEntry[] {
  return PHASES.map((phase) => {
    if (phase === "lunch" || phase === "dinner") {
      return { phase, activity: "eating", area: "Dining hall", label: "Meal time" };
    }
    if (phase === "class" || phase === "prep") {
      return { phase, activity: "working", area: "Academic block", label: "Classes and study" };
    }
    if (phase === "hostel") {
      return { phase, activity: "returning", area: "House hostel", label: "Returning to the house" };
    }
    return { phase, activity: "idle", area: "Main gate", label: "Between classes" };
  });
}

function appearanceFor(config: TeacherConfig): NpcAppearance {
  return {
    skin: config.appearance.skin,
    hair: config.appearance.hair,
    shirt: config.appearance.shirt,
    trousers: config.appearance.trousers,
    accents: config.appearance.accents,
    build: config.appearance.build,
    height: config.appearance.height,
    glasses: config.appearance.glasses,
    beard: config.appearance.beard,
    moustache: config.appearance.moustache,
  };
}

function teacherProfile(id: TeacherId): NpcProfile {
  const config = TEACHER_CONFIGS[id];
  const meta = TEACHER_META[id];
  const schedule =
    meta.kind === "mess"
      ? messSchedule()
      : meta.kind === "support"
        ? supportSchedule(meta.patrolArea)
        : tightSchedule(meta.patrolArea);
  return {
    npcId: `teacher:${id}`,
    name: meta.name,
    role: meta.role,
    gender: config.gender,
    subject: meta.subject ?? config.subject,
    personality: config.personality,
    appearance: appearanceFor(config),
    characterModel: `teacher-rig:${id}`,
    animationSet: meta.kind === "mess" ? MESS_ANIMATIONS : TEACHER_ANIMATIONS,
    patrolArea: meta.patrolArea,
    dailySchedule: schedule,
    currentActivity: "patrolling",
    dialogueProfile: {
      id: `teacher:${id}`,
      style: "teacher-authored",
      tone: config.personality,
      usesAuthenticatedName: true,
    },
    interactionRules: {
      radius: 3.2,
      requiresLineOfSight: true,
      allowDuringDialogue: false,
      cooldownSeconds: 40,
    },
    missionReferences: meta.missionReferences,
    activeStatus: true,
    kind: meta.kind,
    teacherId: id,
  };
}

/** Principal Moinm Rahman, mapped onto the existing authored office actor. */
export const PRINCIPAL_NPC_PROFILE: NpcProfile = {
  npcId: "principal",
  name: PRINCIPAL.name,
  role: PRINCIPAL.role,
  gender: "male",
  subject: "Administration",
  personality: "formal",
  appearance: {
    skin: "#a8734c",
    hair: "#2a211a",
    shirt: "#d9d4c7",
    trousers: "#2d3036",
    accents: "#b79b67",
    build: "regular",
    height: 1.04,
    glasses: true,
    beard: false,
    moustache: true,
  },
  characterModel: "principal-authored-rig",
  animationSet: ["idle", "talk", "gesture", "turn-to-player"],
  patrolArea: PRINCIPAL.chamberName,
  dailySchedule: principalSchedule(),
  currentActivity: "working",
  dialogueProfile: {
    id: "principal:moinm-rahman",
    style: "principal-authored",
    tone: "formal",
    usesAuthenticatedName: true,
  },
  interactionRules: {
    radius: PRINCIPAL.interactionRadius,
    requiresLineOfSight: false,
    allowDuringDialogue: false,
    cooldownSeconds: 0,
  },
  missionReferences: ["principal-chamber"],
  activeStatus: true,
  kind: "principal",
};

/** Meera, the existing authored senior student at the main gate. */
export const MEERA_NPC_PROFILE: NpcProfile = {
  npcId: "student:meera",
  name: "Meera",
  role: "Student",
  gender: "female",
  subject: "Senior · Nilgiri House",
  personality: "friendly",
  appearance: {
    skin: "#b57f56",
    hair: "#171412",
    shirt: "#e6e1d4",
    trousers: "#243352",
    accents: "#7c9a6d",
    build: "slim",
    height: 0.96,
    glasses: false,
    beard: false,
    moustache: false,
  },
  characterModel: "student-authored-rig:meera",
  animationSet: ["idle", "talk", "turn-to-player"],
  patrolArea: "Main gate",
  dailySchedule: studentSchedule(),
  currentActivity: "idle",
  dialogueProfile: {
    id: "student:meera",
    style: "student-authored",
    tone: "friendly",
    usesAuthenticatedName: false,
  },
  interactionRules: {
    radius: 3.4,
    requiresLineOfSight: true,
    allowDuringDialogue: false,
    cooldownSeconds: 0,
  },
  missionReferences: ["meet-meera"],
  activeStatus: true,
  kind: "student",
};

const TEACHER_PROFILES = Object.fromEntries(
  TEACHER_IDS.map((id) => [id, teacherProfile(id)]),
) as Record<TeacherId, NpcProfile>;

const ALL_PROFILES: NpcProfile[] = [
  PRINCIPAL_NPC_PROFILE,
  ...TEACHER_IDS.map((id) => TEACHER_PROFILES[id]),
  MEERA_NPC_PROFILE,
];

export function npcProfileForTeacher(id: TeacherId): NpcProfile {
  return TEACHER_PROFILES[id] ?? teacherProfile(id);
}

export function npcProfileForId(id: string): NpcProfile | null {
  if (id === "principal") return PRINCIPAL_NPC_PROFILE;
  if (id === "meera" || id === "student:meera") return MEERA_NPC_PROFILE;
  if (id.startsWith("teacher:")) return npcProfileForTeacher(id.slice(8) as TeacherId);
  return null;
}

/** Resolves the prompt display data for any existing world interactable. */
export function npcProfileForInteractable(interactable: {
  id: string;
  kind: string;
}): NpcProfile | null {
  if (interactable.kind === "teacher" && interactable.id.startsWith("teacher-")) {
    return npcProfileForTeacher(interactable.id.slice("teacher-".length) as TeacherId);
  }
  if (interactable.kind === "principal" && interactable.id === "principal") {
    return PRINCIPAL_NPC_PROFILE;
  }
  if (interactable.kind === "npc" && interactable.id === "meera") {
    return MEERA_NPC_PROFILE;
  }
  return null;
}

export function allNpcProfiles(): NpcProfile[] {
  return ALL_PROFILES;
}

export function npcScheduleFor(profile: NpcProfile, phase: TimetablePhaseId): NpcScheduleEntry {
  return (
    profile.dailySchedule.find((entry) => entry.phase === phase) ?? {
      phase,
      activity: profile.currentActivity,
      area: profile.patrolArea,
      label: profile.role,
    }
  );
}

export function npcProfileAt(profile: NpcProfile, phase: TimetablePhaseId): NpcProfile {
  return { ...profile, currentActivity: npcScheduleFor(profile, phase).activity };
}

/** Interaction prompt keeps the existing E/touch flow, adding identity only. */
export function npcPromptLabel(profile: NpcProfile): string {
  if (profile.kind === "teacher") return `Talk to ${profile.name} · ${profile.subject}`;
  if (profile.kind === "mess") return `Talk to ${profile.name} · ${profile.role}`;
  if (profile.kind === "principal") return `Talk to ${profile.role} ${profile.name}`;
  return `Talk to ${profile.name} · ${profile.subject}`;
}

