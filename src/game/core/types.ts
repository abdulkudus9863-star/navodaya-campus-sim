/**
 * Shared game types. These are deliberately engine-agnostic so React UI can
 * render state without importing three.js.
 */

export type Quality = "low" | "medium" | "high";

export type Screen = "menu" | "playing" | "paused" | "dialogue" | "notice" | "ending";

export interface GameSettings {
  quality: Quality;
  sensitivity: number;
  invertY: boolean;
  volume: number;
  music: boolean;
  sfx: boolean;
}

export interface CharacterSettings {
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

export interface SaveData {
  version: 1;
  savedAt: number;
  playtime: number;
  player: { position: Vec3Save; rotationY: number };
  settings: GameSettings;
  character: CharacterSettings;
  mission: MissionSave;
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

export interface LoadState {
  status: "idle" | "loading" | "ready" | "error";
  progress: number;
  stage: string;
  error?: string;
}

export interface GameUIState {
  screen: Screen;
  settingsOpen: boolean;
  load: LoadState;
  mission: MissionView;
  dialogue: DialogueView | null;
  notice: NoticeView | null;
  prompt: string | null;
  settings: GameSettings;
  character: CharacterSettings;
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
    objective: "Enter your hostel room",
    hint: "The hostel is east of the assembly ground.",
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
