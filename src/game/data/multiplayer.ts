/**
 * Shared data for the cooperative Operation Midnight Mischief mode.
 * The server keeps an identical copy of the crate layout in
 * src/convex/multiplayer.ts — change both together.
 */

export const MP_MAX_PLAYERS = 4;
export const MP_VEGETABLE_COUNT = 10;
export const MP_MISSION_DURATION_MS = 6 * 60 * 1000;
export const MP_SYNC_INTERVAL = 0.125;
export const MP_ONLINE_WINDOW_MS = 22_000;
export const MP_HIDE_AFTER_MS = 24_000;

/** Team extraction point at the garden gate, between the beds and the hostels. */
export const MP_SAFE_ZONE = { x: -38, z: 31.8, radius: 3.4 } as const;
export const MP_START_POINT = { x: -38, z: 33.4, rotationY: Math.PI } as const;

export interface MultiplayerVegetable {
  id: string;
  name: string;
  x: number;
  z: number;
  color: string;
}

export const MP_VEGETABLES: readonly MultiplayerVegetable[] = [
  { id: "veg-1", name: "Tomato crate", x: -41.8, z: 23.4, color: "#c2453a" },
  { id: "veg-2", name: "Potato crate", x: -40.9, z: 25.6, color: "#b08a5a" },
  { id: "veg-3", name: "Carrot crate", x: -39.6, z: 23.0, color: "#d9822b" },
  { id: "veg-4", name: "Cabbage crate", x: -38.2, z: 24.2, color: "#7fa36a" },
  { id: "veg-5", name: "Pumpkin crate", x: -36.9, z: 22.8, color: "#cf7c2c" },
  { id: "veg-6", name: "Bean crate", x: -35.2, z: 24.3, color: "#6d9a55" },
  { id: "veg-7", name: "Radish crate", x: -42.1, z: 27.4, color: "#b45c6a" },
  { id: "veg-8", name: "Spinach crate", x: -39.5, z: 28.0, color: "#4f7a4a" },
  { id: "veg-9", name: "Pea crate", x: -36.6, z: 27.6, color: "#8fae58" },
  { id: "veg-10", name: "Chilli crate", x: -34.2, z: 26.4, color: "#b5342f" },
];

export const MP_VEGETABLE_IDS: readonly string[] = MP_VEGETABLES.map((item) => item.id);

export type MultiplayerAnim = "idle" | "walk" | "run" | "jump" | "crouch";

export interface MultiplayerLocalState {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  moving: boolean;
  crouching: boolean;
  anim: MultiplayerAnim;
}

export interface MultiplayerRemotePlayer extends MultiplayerLocalState {
  memberId: string;
  name: string;
  houseId: string;
  characterId: string;
  lastSeen: number;
}

/** Presentation-only player marker for the live campus map. */
export interface MapRemoteMarker {
  memberId: string;
  name: string;
  houseId: string;
  x: number;
  z: number;
  lastSeen: number;
}

/** The engine never talks to Convex directly; the React layer owns the network. */
export interface MultiplayerAdapter {
  onLocalMove(state: MultiplayerLocalState): void;
  onCollect(itemId: string, x: number, z: number): void;
  onReturnToSafe(x: number, z: number): void;
}

export function isInsideSafeZone(x: number, z: number): boolean {
  return Math.hypot(x - MP_SAFE_ZONE.x, z - MP_SAFE_ZONE.z) <= MP_SAFE_ZONE.radius;
}

export function multiplayerClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
