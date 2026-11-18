/**
 * Shared game types. These are deliberately engine-agnostic so React UI can
 * render state without importing three.js. House IDs are the only domain types
 * that cross from the data layer into the save format.
 */
import type { CampusMapView } from "../data/campus";
import type { GardenItemId } from "../data/night";
import type { HouseId } from "../data/houses";
import type { EscapeSave } from "../data/escape";
import type { ClassBunkSave } from "../data/classBunk";
import type { MessMealSave } from "../data/messMeal";

export type Quality = "low" | "medium" | "high";

export type Screen =
  | "menu"
  | "creation"
  | "playing"
  | "paused"
  | "dialogue"
  | "notice"
  | "ending"
  | "night-result"
  | "adventure"
  | "escape";

export interface GameSettings {
  quality: Quality;
  sensitivity: number;
  invertY: boolean;
  volume: number;
  music: boolean;
  sfx: boolean;
}

export type FaceShape = "oval" | "round" | "square";
export type HairStyle = "short" | "side" | "curly" | "bun" | "braid";
export type HairColor = "black" | "brown" | "soft";
export type EyeColor = "brown" | "dark" | "hazel";
export type BrowStyle = "straight" | "soft" | "bold";
export type BodyBuild = "slim" | "regular" | "broad";
export type GlassesStyle = "none" | "round" | "rect";
export type WatchStyle = "none" | "steel" | "black";
export type BackpackStyle = "none" | "navy" | "olive";

export type TeacherPersonalityId = "strict" | "friendly" | "serious" | "funny" | "neutral";
export type TeacherAreaId =
  | "hostel"
  | "academic"
  | "playground"
  | "dining"
  | "entrance"
  | "assembly"
  | "garden"
  | "library";
export type TimetablePhaseId =
  | "assembly"
  | "class"
  | "break"
  | "lunch"
  | "games"
  | "prep"
  | "dinner"
  | "hostel";

export interface CharacterSettings {
  /** Retained for save compatibility. The vest colour is taken from the house. */
  uniform: "navy" | "olive" | "maroon";
  skin: 0 | 1 | 2 | 3;
  face: FaceShape;
  hairStyle: HairStyle;
  hairColor: HairColor;
  eyeColor: EyeColor;
  brows: BrowStyle;
  build: BodyBuild;
  glasses: GlassesStyle;
  watch: WatchStyle;
  backpack: BackpackStyle;
}

export interface Vec3Save {
  x: number;
  y: number;
  z: number;
}

export interface MissionSave {
  started: boolean;
  step: number;
  completed: string[];
}

export interface PlayerProfileSave {
  playerId: string;
  characterId: string;
  houseId: HouseId;
  assignedAt: number;
  xp: number;
  level: number;
  achievements: string[];
}

export interface NightSave {
  active: boolean;
  started: boolean;
  step: number;
  collected: GardenItemId[];
  attempts: number;
  caught: boolean;
  success: boolean;
  completedAt: number | null;
}

export interface ExplorationSave {
  discovered: string[];
  planSeen: boolean;
  tourStarted: boolean;
}

export interface ExplorationView {
  discovered: number;
  total: number;
  nextUnlock: string | null;
  tourStarted: boolean;
}

export interface TeacherMemoryEntry {
  at: number;
  encounter: number;
  question: string;
  reply: string;
  outcome: "positive" | "neutral" | "warning" | "disciplined";
  warned: boolean;
}

export interface TeacherMemory {
  encounters: number;
  warnings: number;
  lastSeenAt: number;
  lastQuestion: string | null;
  lastOutcome: TeacherMemoryEntry["outcome"] | null;
  history: TeacherMemoryEntry[];
}

export interface TeacherDisciplineSave {
  active: boolean;
  teacherId: string;
  task: "return-hostel" | null;
  startedAt: number;
  deadlineAt: number;
}

export interface TeacherSave {
  reputation: number;
  memories: Record<string, TeacherMemory>;
  discipline: TeacherDisciplineSave;
  cooldowns: Record<string, number>;
}

export interface DisciplineView {
  active: boolean;
  teacherName: string;
  task: string;
  secondsLeft: number;
}

export type PrincipalReferralStatus = "assigned" | "in-progress" | "completed";

export interface PrincipalReferralSave {
  active: boolean;
  status: PrincipalReferralStatus;
  teacherId: string | null;
  teacherName: string | null;
  reason: string | null;
  assignedAt: number;
  completedAt: number | null;
}

export interface PrincipalReferralView {
  active: boolean;
  status: PrincipalReferralStatus;
  title: string;
  objective: string;
  teacherName: string | null;
  reason: string | null;
  destination: { x: number; z: number };
  route: { x: number; z: number }[];
  distance: number;
  insideChamber: boolean;
}

export interface TeacherDialogueMeta {
  teacherId: string;
  name: string;
  subject: string;
  gender: "male" | "female" | "unspecified";
  personality: TeacherPersonalityId;
  personalityLabel: string;
  period: string;
  location: string;
  warningCount: number;
  reputation: number;
  mood: "stern" | "calm" | "encouraging" | "amused";
  portrait: {
    skin: string;
    hair: string;
    shirt: string;
    accents: string;
    glasses: boolean;
    beard: boolean;
    moustache: boolean;
  };
  notice: string | null;
}

export interface SaveData {
  version: 2;
  savedAt: number;
  playtime: number;
  player: { position: Vec3Save; rotationY: number };
  settings: GameSettings;
  character: CharacterSettings;
  mission: MissionSave;
  profile: PlayerProfileSave;
  night: NightSave;
  exploration: ExplorationSave;
  escape: EscapeSave;
  teachers: TeacherSave;
  principalReferral: PrincipalReferralSave;
  classBunk: ClassBunkSave;
  messMeal: MessMealSave;
}

export interface DialogueChoice {
  label: string;
  next: string;
}

export interface DialogueNode {
  id: string;
  text: string;
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueView {
  speaker: string;
  role: string;
  text: string;
  choices: { label: string; next: string }[];
  canAdvance: boolean;
  /** Present only for teacher conversations; legacy NPC dialogue omits it. */
  teacher?: TeacherDialogueMeta;
}

export interface NoticeView {
  title: string;
  subtitle: string;
  items: { heading: string; body: string }[];
}

export interface MissionStep {
  id: string;
  title: string;
  objective: string;
  hint: string;
}

export interface MissionView {
  title: string;
  objective: string;
  hint: string;
  step: number;
  total: number;
  completed: string[];
  done: boolean;
}

export interface PlayerProfileView {
  playerId: string;
  characterId: string;
  characterName: string;
  houseId: HouseId;
  houseName: string;
  houseColor: string;
  className: string;
  xp: number;
  level: number;
  achievements: string[];
  assignedAt: number;
}

export interface NightView {
  active: boolean;
  step: number;
  total: number;
  title: string;
  objective: string;
  hint: string;
  collected: GardenItemId[];
  suspicion: number;
  hidden: boolean;
  caught: boolean;
  attempts: number;
  completedOnce: boolean;
}

export interface GardenDutyView {
  active: boolean;
  watered: number;
  total: number;
  complete: boolean;
}

export interface ClassBunkObjectiveView {
  id: string;
  label: string;
  area: string;
  x: number;
  z: number;
  complete: boolean;
}

export interface ClassBunkResultView {
  outcome: "completed" | "failed" | "ended";
  title: string;
  message: string;
}

export interface ClassBunkView {
  active: boolean;
  difficulty: "easy" | "normal" | "hard";
  difficultyLabel: string;
  status: "exploring" | "return" | "caught" | "completed" | "failed" | "ended";
  secondsLeft: number;
  objectives: ClassBunkObjectiveView[];
  completed: number;
  total: number;
  suspicion: number;
  exposed: boolean;
  caughtBy: string | null;
  result: ClassBunkResultView | null;
  completedOnce: boolean;
}

export interface MessMealObjectiveView {
  id: string;
  label: string;
  complete: boolean;
}

export interface MessMealResultView {
  outcome: "completed" | "failed" | "ended";
  title: string;
  message: string;
}

export interface MessMealView {
  active: boolean;
  difficulty: "easy" | "normal" | "hard";
  difficultyLabel: string;
  status: "to-mess" | "return" | "caught" | "completed" | "failed" | "ended";
  mealCollected: boolean;
  objectives: MessMealObjectiveView[];
  completed: number;
  total: number;
  suspicion: number;
  exposed: boolean;
  caughtBy: string | null;
  target: { x: number; z: number; label: string } | null;
  result: MessMealResultView | null;
  completedOnce: boolean;
}

export interface NightResultView {
  outcome: "success" | "caught";
  title: string;
  message: string;
  xpAwarded: number;
  rewardAlreadyClaimed: boolean;
  achievementId: string | null;
  collected: GardenItemId[];
  attempts: number;
}

export interface LoadState {
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  stage: string;
  error?: string;
}

export interface GameUIState {
  screen: Screen;
  settingsOpen: boolean;
  profileOpen: boolean;
  load: LoadState;
  mission: MissionView;
  dialogue: DialogueView | null;
  notice: NoticeView | null;
  prompt: string | null;
  settings: GameSettings;
  character: CharacterSettings;
  profile: PlayerProfileView | null;
  night: NightView | null;
  nightResult: NightResultView | null;
  escapeSave: EscapeSave | null;
  gardenDuty: GardenDutyView | null;
  discipline: DisciplineView | null;
  principalReferral: PrincipalReferralView | null;
  classBunk: ClassBunkView | null;
  messMeal: MessMealView | null;
  exploration: ExplorationView | null;
  planOpen: boolean;
  campusMapOpen: boolean;
  cameraOverview: boolean;
  campusMap: CampusMapView | null;
  crouching: boolean;
  hasSave: boolean;
  saveBusy: boolean;
  toast: string | null;
  quality: Quality;
  autoAdjusted: boolean;
  isTouch: boolean;
  playtime: number;
  ending: { minutes: number; steps: number } | null;
  pointerLocked: boolean;
  fps: number;
}

export const MISSION_TITLE = "Welcome to Your New Campus";

export const MISSION_STEPS: MissionStep[] = [
  {
    id: "meet-meera",
    title: "Meet your guide",
    objective: "Talk to Meera near the main gate",
    hint: "She is standing just inside the gate, on the path.",
  },
  {
    id: "notice-board",
    title: "Read the notice board",
    objective: "Read the notice board by the assembly ground",
    hint: "The board stands east of the assembly ground.",
  },
  {
    id: "classroom",
    title: "Find your classroom",
    objective: "Step inside the academic block classroom",
    hint: "The academic block is on the west side of the campus.",
  },
  {
    id: "hostel",
    title: "Report to your room",
    objective: "Enter your house hostel",
    hint: "Four house hostels stand along the south lawn. Yours has your colours over the door.",
  },
];

export const DEFAULT_SETTINGS: GameSettings = {
  quality: "high",
  sensitivity: 1,
  invertY: false,
  volume: 0.65,
  music: true,
  sfx: true,
};

export const DEFAULT_CHARACTER: CharacterSettings = {
  uniform: "navy",
  skin: 1,
  face: "oval",
  hairStyle: "short",
  hairColor: "black",
  eyeColor: "brown",
  brows: "straight",
  build: "regular",
  glasses: "none",
  watch: "none",
  backpack: "none",
};

export const PLAYER_CLASS = "VII";

export const UNIFORM_COLORS: Record<CharacterSettings["uniform"], string> = {
  navy: "#243352",
  olive: "#44523c",
  maroon: "#5a2a35",
};

export const SKIN_TONES: string[] = ["#8a5a3c", "#b57f56", "#d7a47b", "#6b4630"];

export function initialMission(): MissionView {
  const step = MISSION_STEPS[0];
  return {
    title: MISSION_TITLE,
    objective: step.objective,
    hint: step.hint,
    step: 0,
    total: MISSION_STEPS.length,
    completed: [],
    done: false,
  };
}

export function emptyNightSave(): NightSave {
  return {
    active: false,
    started: false,
    step: 0,
    collected: [],
    attempts: 0,
    caught: false,
    success: false,
    completedAt: null,
  };
}
