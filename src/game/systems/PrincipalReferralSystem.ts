import type {
  PrincipalReferralSave,
  PrincipalReferralStatus,
  PrincipalReferralView,
} from "../core/types";
import {
  PRINCIPAL,
  PRINCIPAL_MISSION,
  isInsidePrincipalChamber,
} from "../data/principal";
import { CampusPathfinder, type PathPoint } from "./CampusPathfinder";

const ROUTE_DRIFT = 3.2;
const REROUTE_INTERVAL = 6;

export function emptyPrincipalReferral(): PrincipalReferralSave {
  return {
    active: false,
    status: "completed",
    teacherId: null,
    teacherName: null,
    reason: null,
    assignedAt: 0,
    completedAt: null,
  };
}

/**
 * Owns the teacher-to-Principal referral, its saved status and the walkable
 * route. The route is presentation data only; it is rebuilt from the live
 * campus colliders and never persisted.
 */
export class PrincipalReferralSystem {
  private data: PrincipalReferralSave;
  private pathfinder: CampusPathfinder;
  private route: PathPoint[] = [];
  private origin = { x: 0, z: 0 };
  private routeAge = 0;
  private lastDistance = 0;

  constructor(colliders: ConstructorParameters<typeof CampusPathfinder>[0], saved?: PrincipalReferralSave) {
    this.pathfinder = new CampusPathfinder(colliders);
    this.data = this.sanitize(saved);
  }

  get isActive(): boolean {
    return this.data.active;
  }

  get teacherName(): string | null {
    return this.data.teacherName;
  }

  assign(input: {
    teacherId: string;
    teacherName: string;
    reason: string;
    player: { x: number; z: number };
    now?: number;
  }): boolean {
    if (this.data.active) return false;
    this.data = {
      active: true,
      status: "assigned",
      teacherId: input.teacherId,
      teacherName: input.teacherName,
      reason: input.reason.slice(0, 180),
      assignedAt: input.now ?? Date.now(),
      completedAt: null,
    };
    this.origin = { x: input.player.x, z: input.player.z };
    this.route = [];
    this.routeAge = 0;
    this.rebuildRoute(input.player);
    return true;
  }

  restore(saved?: PrincipalReferralSave, player?: { x: number; z: number }): void {
    this.data = this.sanitize(saved);
    this.route = [];
    this.routeAge = 0;
    if (this.data.active && player) {
      this.origin = { x: player.x, z: player.z };
      this.rebuildRoute(player);
    }
  }

  reset(): void {
    this.data = emptyPrincipalReferral();
    this.route = [];
    this.routeAge = 0;
  }

  update(player: { x: number; z: number }, dt: number): PrincipalReferralView | null {
    if (!this.data.active) return null;
    const inside = isInsidePrincipalChamber(player.x, player.z);
    if (this.data.status === "assigned" && Math.hypot(player.x - this.origin.x, player.z - this.origin.z) > 1.5) {
      this.data.status = "in-progress";
    }
    this.routeAge += dt;
    const drifted = this.pathfinder.distanceToRoute(this.route, player.x, player.z) > ROUTE_DRIFT;
    if (this.route.length === 0 || drifted || this.routeAge >= REROUTE_INTERVAL) {
      this.rebuildRoute(player);
    }
    if (this.route.length > 0) {
      this.lastDistance = this.pathfinder.remainingDistance(this.route, player.x, player.z);
    } else {
      this.lastDistance = Math.hypot(PRINCIPAL.chamber.x - player.x, PRINCIPAL.chamber.z - player.z);
    }
    if (inside) this.data.status = "in-progress";
    return this.view(player, inside);
  }

  view(player: { x: number; z: number }, inside = isInsidePrincipalChamber(player.x, player.z)): PrincipalReferralView {
    return {
      active: this.data.active,
      status: this.data.status,
      title: PRINCIPAL_MISSION.title,
      objective: PRINCIPAL_MISSION.objective,
      teacherName: this.data.teacherName,
      reason: this.data.reason,
      destination: { x: PRINCIPAL.chamber.x, z: PRINCIPAL.chamber.z },
      route: this.route.map((point) => ({ ...point })),
      distance: this.lastDistance,
      insideChamber: inside,
    };
  }

  complete(now = Date.now()): boolean {
    if (!this.data.active) return false;
    this.data = {
      ...this.data,
      active: false,
      status: "completed",
      completedAt: now,
    };
    this.route = [];
    this.lastDistance = 0;
    return true;
  }

  toSave(): PrincipalReferralSave {
    return { ...this.data };
  }

  private rebuildRoute(player: { x: number; z: number }): void {
    this.routeAge = 0;
    const path = this.pathfinder.findPath(player, PRINCIPAL.routePoint);
    this.route = path && path.length > 1 ? path : [];
    if (this.route.length > 0) {
      this.lastDistance = this.pathfinder.remainingDistance(this.route, player.x, player.z);
    }
  }

  private sanitize(raw?: PrincipalReferralSave): PrincipalReferralSave {
    const fallback = emptyPrincipalReferral();
    if (!raw || typeof raw !== "object") return fallback;
    const status: PrincipalReferralStatus =
      raw.status === "assigned" || raw.status === "in-progress" || raw.status === "completed"
        ? raw.status
        : raw.active
          ? "assigned"
          : "completed";
    return {
      active: raw.active === true && status !== "completed",
      status: raw.active === true ? status : "completed",
      teacherId: typeof raw.teacherId === "string" ? raw.teacherId.slice(0, 32) : null,
      teacherName: typeof raw.teacherName === "string" ? raw.teacherName.slice(0, 80) : null,
      reason: typeof raw.reason === "string" ? raw.reason.slice(0, 180) : null,
      assignedAt: Number.isFinite(raw.assignedAt) ? Math.max(0, Number(raw.assignedAt)) : 0,
      completedAt: Number.isFinite(raw.completedAt) ? Math.max(0, Number(raw.completedAt)) : null,
    };
  }
}
