import type { ExplorationSave } from "../core/types";
import {
  CAMPUS_LOCATIONS,
  CAMPUS_TOTAL,
  houseMapMarkers,
  locationsForHouse,
  type CampusMapView,
} from "../data/campus";
import { getHouse, type HouseId } from "../data/houses";

export const EXPLORATION_ACHIEVEMENTS = [
  { id: "campus-wanderer", at: 3, xp: 40 },
  { id: "campus-cartographer", at: 6, xp: 80 },
  { id: "campus-life", at: CAMPUS_TOTAL, xp: 120 },
] as const;

export class ExplorationSystem {
  private discovered = new Set<string>();
  private planSeen = false;
  private tourStarted = false;

  restore(save: ExplorationSave | undefined): void {
    this.discovered = new Set(save?.discovered ?? []);
    this.planSeen = save?.planSeen ?? false;
    this.tourStarted = save?.tourStarted ?? false;
  }

  reset(): void {
    this.discovered.clear();
    this.planSeen = false;
    this.tourStarted = false;
  }

  get count(): number {
    return this.discovered.size;
  }

  get hasSeenPlan(): boolean {
    return this.planSeen;
  }

  get started(): boolean {
    return this.tourStarted;
  }

  markPlanSeen(): void {
    this.planSeen = true;
  }

  startTour(): void {
    this.tourStarted = true;
    this.planSeen = true;
  }

  isDiscovered(id: string): boolean {
    return this.discovered.has(id);
  }

  isUnlocked(id: string): boolean {
    const location = CAMPUS_LOCATIONS.find((candidate) => candidate.id === id);
    if (!location) return false;
    return this.discovered.has(id) || this.count >= location.unlockAt;
  }

  /**
   * Records a location when the player is physically inside its campus zone.
   * Returns the newly discovered location definitions and any milestone.
   */
  discoverNearby(
    x: number,
    z: number,
    houseId: HouseId,
  ): {
    discovered: { id: string; name: string; story: string } | null;
    milestone: { id: string; xp: number; count: number } | null;
  } {
    for (const location of locationsForHouse(houseId)) {
      if (this.discovered.has(location.id)) continue;
      if (!this.isUnlocked(location.id)) continue;
      const dx = x - location.x;
      const dz = z - location.z;
      if (Math.hypot(dx, dz) > location.radius) continue;
      this.discovered.add(location.id);
      this.tourStarted = true;
      const milestone = EXPLORATION_ACHIEVEMENTS.find((entry) => this.count === entry.at);
      return {
        discovered: { id: location.id, name: location.name, story: location.story },
        milestone: milestone ? { id: milestone.id, xp: milestone.xp, count: this.count } : null,
      };
    }
    return { discovered: null, milestone: null };
  }

  mapView(houseId: HouseId, x: number, z: number): CampusMapView {
    const locations = locationsForHouse(houseId).map((location) => ({
      ...location,
      discovered: this.discovered.has(location.id),
      unlocked: this.isUnlocked(location.id),
      isPlayerHouseHostel: Boolean(location.dynamicHostel),
    }));
    const next = locations
      .filter((location) => !location.unlocked)
      .reduce<{ count: number; names: string[] } | null>((current, location) => {
        if (!current || location.unlockAt < current.count) {
          return { count: location.unlockAt, names: [location.shortName] };
        }
        if (location.unlockAt === current.count) current.names.push(location.shortName);
        return current;
      }, null);
    return {
      locations,
      discovered: this.count,
      total: CAMPUS_TOTAL,
      nextUnlock: next,
      playerX: x,
      playerZ: z,
      houseMarkers: houseMapMarkers(houseId),
      houseId,
      note: "Interpretive recreation inspired by JNV Bishnupur, Manipur. Building positions and walking routes are game design, not a surveyed plan. People, houses, stories and the midnight caper are fictional.",
    };
  }

  toSave(): ExplorationSave {
    return {
      discovered: [...this.discovered]
        .filter((id) => CAMPUS_LOCATIONS.some((location) => location.id === id))
        .sort(),
      planSeen: this.planSeen,
      tourStarted: this.tourStarted,
    };
  }
}

export function sanitizeExploration(raw: unknown): ExplorationSave {
  const source = (raw ?? {}) as Partial<ExplorationSave>;
  const valid = new Set(CAMPUS_LOCATIONS.map((location) => location.id));
  const discovered = Array.isArray(source.discovered)
    ? Array.from(
        new Set(source.discovered.filter((id): id is string => typeof id === "string" && valid.has(id))),
      )
    : [];
  return {
    discovered,
    planSeen: source.planSeen === true,
    tourStarted: source.tourStarted === true,
  };
}

export function explorationHouseName(houseId: HouseId): string {
  return getHouse(houseId)?.shortName ?? "House";
}
