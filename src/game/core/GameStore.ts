import { useSyncExternalStore } from "react";
import {
  DEFAULT_CHARACTER,
  DEFAULT_SETTINGS,
  initialMission,
  type CharacterSettings,
  type DialogueView,
  type GameSettings,
  type GameUIState,
  type MissionView,
  type NoticeView,
  type SaveData,
  type Screen,
} from "./types";

type Listener = () => void;

/**
 * Tiny observable store bridging the imperative game engine and the React UI.
 * The engine owns gameplay truth; React only reads snapshots and calls the
 * engine's public methods.
 */
export class GameStore {
  private state: GameUIState;
  private listeners = new Set<Listener>();

  constructor(hasSave: boolean, isTouch: boolean, settings?: GameSettings) {
    this.state = {
      screen: "menu",
      settingsOpen: false,
      load: { status: "idle", progress: 0, stage: "Preparing" },
      mission: initialMission(),
      dialogue: null,
      notice: null,
      prompt: null,
      settings: settings ?? { ...DEFAULT_SETTINGS },
      character: { ...DEFAULT_CHARACTER },
      profile: null,
      night: null,
      nightResult: null,
      escapeSave: null,
      gardenDuty: null,
      discipline: null,
      principalReferral: null,
      exploration: null,
      planOpen: false,
      campusMapOpen: false,
      cameraOverview: false,
      campusMap: null,
      profileOpen: false,
      crouching: false,
      hasSave,
      saveBusy: false,
      toast: null,
      quality: settings?.quality ?? DEFAULT_SETTINGS.quality,
      autoAdjusted: false,
      isTouch,
      playtime: 0,
      ending: null,
      pointerLocked: false,
      fps: 60,
    };
  }

  getState = (): GameUIState => this.state;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  patch = (partial: Partial<GameUIState>): void => {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof GameUIState)[]) {
      if (partial[key] !== undefined && this.state[key] !== partial[key]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    this.notify();
  };

  notify(): void {
    for (const listener of this.listeners) listener();
  }

  setScreen(screen: Screen): void {
    this.patch({ screen });
  }

  setLoad(patch: Partial<GameUIState["load"]>): void {
    this.patch({ load: { ...this.state.load, ...patch } });
  }

  setMission(mission: MissionView): void {
    this.patch({ mission });
  }

  setPrompt(prompt: string | null): void {
    this.patch({ prompt });
  }

  setDialogue(dialogue: DialogueView | null): void {
    this.patch({ dialogue });
  }

  setNotice(notice: NoticeView | null): void {
    this.patch({ notice });
  }

  setSettings(settings: GameSettings): void {
    this.patch({ settings, quality: settings.quality });
  }

  setCharacter(character: CharacterSettings): void {
    this.patch({ character });
  }

  toast(message: string): void {
    this.patch({ toast: message });
  }

  hydrateSave(data: SaveData): void {
    this.patch({
      settings: data.settings,
      character: data.character,
      quality: data.settings.quality,
      hasSave: true,
      playtime: data.playtime,
      escapeSave: data.escape,
    });
  }
}

export function useGameState(store: GameStore): GameUIState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
