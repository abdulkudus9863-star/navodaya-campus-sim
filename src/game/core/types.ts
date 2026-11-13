/**
 * Shared game types. These are deliberately engine-agnostic so React UI can
 * render state without importing three.js. House IDs are the only domain types
 * that cross from the data layer into the save format.
 */
import type { GardenItemId } from "../data/night";
import type { HouseId } from "../data/houses";

export type Quality = "low" | "medium" | "high";

export type Screen =
  | "menu"
  | "creation"
  | "playing"
  | "paused"
  | "dialogue"
  | "notice"
  | "ending"
  | "night-result";

export interface GameSettings {
  quality: Quality;
  sensitivity: number;
  invertY: boolean;
  volume: number;
  music: boolean;
  sfx: boolean;
}

export interface CharacterSettings {
  /** Retained for save compatibility. The vest colour is taken from the house. */
  uniform: "navy" | "olive" | "maroon";
  skin: 0 | 1 | 2 | 3;
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
  gardenDuty: GardenDutyView | null;
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
