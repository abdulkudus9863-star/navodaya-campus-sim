import { HOUSE_COLORS, HOUSES, type HouseId } from "./houses";
import { MP_SAFE_ZONE, type MapRemoteMarker } from "./multiplayer";
import { locationsForHouse, type CampusLocationKind } from "./campus";

/** The playable campus is bounded at +/-55 on both ground axes. */
export const MAP_WORLD_LIMIT = 55;
export const MAP_MARGIN = 4;

/**
 * One projection for the HUD mini-map and the expanded campus map. Map space
 * is 0..100 with north up, matching the Three.js world's -Z direction.
 */
export function worldToMap(x: number, z: number): { x: number; y: number } {
  const scale = (100 - MAP_MARGIN * 2) / (MAP_WORLD_LIMIT * 2);
  return {
    x: 50 + x * scale,
    y: 50 + z * scale,
  };
}

/** Visual anchor for map pins when a gameplay point sits inside a gateway area. */
export function mapAnchorForLocation(location: {
  id: string;
  x: number;
  z: number;
}): { x: number; z: number } {
  if (location.id === "main-gate") return { x: 0, z: 49.2 };
  return { x: location.x, z: location.z };
}

export function mapWorldDistance(
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
): number {
  return Math.hypot(fromX - toX, fromZ - toZ);
}

export function formatMapDistance(meters: number): string {
  if (!Number.isFinite(meters)) return "—";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(meters))} m`;
}

export type MapFootprintTone = "building" | "field" | "garden" | "house" | "court";

export interface MapFootprint {
  id: string;
  name: string;
  shortName: string;
  kind: CampusLocationKind;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  shape: "rect" | "oval";
  tone: MapFootprintTone;
  color?: string;
  label?: boolean;
}

/**
 * Footprints follow the actual WorldEnvironment geometry. They are intentionally
 * simple plan shapes, not a surveyed campus plan; positions and extents come
 * from the same constants used to build the 3D buildings.
 */
export const MAP_FOOTPRINTS: readonly MapFootprint[] = [
  {
    id: "main-gate",
    name: "Main Gate",
    shortName: "Gate",
    kind: "entrance",
    minX: -8.4,
    maxX: 8.4,
    minZ: 49,
    maxZ: 50.9,
    shape: "rect",
    tone: "building",
  },
  {
    id: "security-cabin",
    name: "Security Cabin",
    shortName: "Security",
    kind: "entrance",
    minX: -12.6,
    maxX: -8.4,
    minZ: 42.8,
    maxZ: 46.2,
    shape: "rect",
    tone: "building",
  },
  {
    id: "assembly-ground",
    name: "Assembly Ground",
    shortName: "Assembly",
    kind: "assembly",
    minX: -15,
    maxX: 15,
    minZ: -8,
    maxZ: 16,
    shape: "rect",
    tone: "court",
    label: true,
  },
  {
    id: "academic-block",
    name: "Academic Block A",
    shortName: "Academic",
    kind: "academic",
    minX: -44,
    maxX: -16,
    minZ: -13,
    maxZ: 11,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "academic-block-b",
    name: "Academic Block B",
    shortName: "Block B",
    kind: "academic",
    minX: 24,
    maxX: 44,
    minZ: -29,
    maxZ: -14,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "indoor-sports-hall",
    name: "Indoor Sports Hall",
    shortName: "Indoor hall",
    kind: "sports",
    minX: 44.5,
    maxX: 54,
    minZ: -28,
    maxZ: -11,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "administration",
    name: "Administration",
    shortName: "Admin",
    kind: "administration",
    minX: 7.5,
    maxX: 18.5,
    minZ: 39.7,
    maxZ: 47.3,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "dining-hall",
    name: "Dining Hall",
    shortName: "Dining",
    kind: "dining",
    minX: -14,
    maxX: 18,
    minZ: -44.7,
    maxZ: -31.3,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "kitchen",
    name: "Kitchen",
    shortName: "Kitchen",
    kind: "dining",
    minX: 18.5,
    maxX: 25.5,
    minZ: -43.5,
    maxZ: -36.5,
    shape: "rect",
    tone: "building",
  },
  {
    id: "science-labs",
    name: "Science Laboratories",
    shortName: "Labs",
    kind: "laboratory",
    minX: 28.5,
    maxX: 43.5,
    minZ: -43.3,
    maxZ: -32.7,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "library",
    name: "Library",
    shortName: "Library",
    kind: "library",
    minX: -45,
    maxX: -27,
    minZ: -37.3,
    maxZ: -22.7,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "residence-block",
    name: "Residential Block",
    shortName: "Residence",
    kind: "hostel",
    minX: 16,
    maxX: 44,
    minZ: -6,
    maxZ: 22,
    shape: "rect",
    tone: "building",
    label: true,
  },
  {
    id: "sports-pavilion",
    name: "Sports Pavilion",
    shortName: "Pavilion",
    kind: "sports",
    minX: 45.5,
    maxX: 50.5,
    minZ: 14.3,
    maxZ: 17.7,
    shape: "rect",
    tone: "building",
  },
  ...HOUSES.map((house, index) => {
    const cx = [-45, -36.5, -28, -19.5][index] ?? -45;
    return {
      id: `house-${house.id}`,
      name: house.hostelName,
      shortName: house.shortName,
      kind: "hostel" as const,
      minX: cx - 3.2,
      maxX: cx + 3.2,
      minZ: 35,
      maxZ: 41,
      shape: "rect" as const,
      tone: "house" as const,
      color: HOUSE_COLORS[house.id],
      label: true,
    };
  }),
  {
    id: "sports-ground",
    name: "Sports Ground",
    shortName: "Sports",
    kind: "sports",
    minX: 22,
    maxX: 52,
    minZ: 25,
    maxZ: 47,
    shape: "oval",
    tone: "field",
    label: true,
  },
  {
    id: "basketball",
    name: "Basketball Court",
    shortName: "Basketball",
    kind: "sports",
    minX: 27,
    maxX: 41,
    minZ: -54,
    maxZ: -46,
    shape: "rect",
    tone: "court",
    label: true,
  },
  {
    id: "volleyball",
    name: "Volleyball Court",
    shortName: "Volleyball",
    kind: "sports",
    minX: 42.5,
    maxX: 53.5,
    minZ: -54.3,
    maxZ: -47.3,
    shape: "rect",
    tone: "court",
    label: true,
  },
  {
    id: "harbour-garden",
    name: "Campus Gardens",
    shortName: "Gardens",
    kind: "garden",
    minX: -45.4,
    maxX: -30.6,
    minZ: 18.6,
    maxZ: 33.4,
    shape: "oval",
    tone: "garden",
    label: true,
  },
] as const;

/** Walkable roads/paths taken from the WorldEnvironment path layout. */
export const MAP_ROADS: readonly { points: readonly { x: number; z: number }[] }[] = [
  { points: [ { x: 0, z: 55 }, { x: 0, z: 16 } ] },
  { points: [ { x: -14, z: 31.4 }, { x: -46, z: 31.4 } ] },
  { points: [ { x: 8, z: -8 }, { x: 8, z: -26 }, { x: 2, z: -30.5 } ] },
  { points: [ { x: -10, z: -5 }, { x: -26, z: -21 } ] },
  { points: [ { x: 15, z: 12 }, { x: 26, z: 26 }, { x: 32, z: 28 } ] },
  { points: [ { x: 26.5, z: -46 }, { x: 48, z: -46 } ] },
] as const;

export interface MapWaypoint {
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface MapMissionTarget {
  id: string;
  label: string;
  x: number;
  z: number;
}

export interface LiveMapSnapshot {
  playerX: number;
  playerZ: number;
  rotationY: number;
  remotes: MapRemoteMarker[];
}

/** Single-player mission objectives, using the same coordinates as the 3D scene. */
const MISSION_TARGETS: readonly MapMissionTarget[] = [
  { id: "meet-meera", label: "Meet Meera", x: 4.2, z: 31 },
  { id: "notice-board", label: "Notice board", x: 9.9, z: 20 },
  { id: "classroom", label: "Classroom", x: -15.1, z: 0 },
];

export function missionTargetFor(
  step: number,
  houseId: HouseId,
  multiplayer: boolean,
): MapMissionTarget | null {
  if (multiplayer) {
    return {
      id: "mp-extraction",
      label: "Garden gate extraction",
      x: MP_SAFE_ZONE.x,
      z: MP_SAFE_ZONE.z,
    };
  }
  if (step >= 0 && step < MISSION_TARGETS.length) return MISSION_TARGETS[step];
  if (step === 3) {
    const hostel = locationsForHouse(houseId).find((location) => location.dynamicHostel);
    if (!hostel) return null;
    return { id: "hostel", label: "Your hostel", x: hostel.x, z: 34.4 };
  }
  return null;
}

