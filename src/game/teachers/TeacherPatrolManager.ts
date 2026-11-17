import {
  TEACHER_CONFIGS,
  TEACHER_IDS,
  TEACHER_ROUTES,
  isTeacherPersonality,
  isTeacherPlace,
  type TeacherConfig,
  type TeacherId,
  type TeacherRouteArea,
} from "../data/teachers";
import type { TeacherPersonalityId } from "../core/types";

export interface TeacherConfigPatch {
  personality?: TeacherPersonalityId;
  patrolAreas?: string[];
  gender?: "male" | "female" | "unspecified";
  speed?: number;
}

/**
 * Owns editable roster configuration and selects the next patrol area after a
 * loop. There is exactly one config per teacher, so duplicate teacher spawning
 * is impossible by construction.
 */
export class TeacherPatrolManager {
  private configs: Record<TeacherId, TeacherConfig>;
  private areaIndex: Record<TeacherId, number> = Object.fromEntries(
    TEACHER_IDS.map((id) => [id, 0]),
  ) as Record<TeacherId, number>;
  private routeLoops: Record<TeacherId, number> = Object.fromEntries(
    TEACHER_IDS.map((id) => [id, 0]),
  ) as Record<TeacherId, number>;

  constructor(overrides: Partial<Record<TeacherId, TeacherConfigPatch>> = {}) {
    this.configs = Object.fromEntries(
      TEACHER_IDS.map((id) => [
        id,
        { ...TEACHER_CONFIGS[id], appearance: { ...TEACHER_CONFIGS[id].appearance } },
      ]),
    ) as Record<TeacherId, TeacherConfig>;
    for (const [id, patch] of Object.entries(overrides)) {
      this.applyPatch(id as TeacherId, patch);
    }
  }

  get(id: TeacherId): TeacherConfig {
    return this.configs[id];
  }

  all(): TeacherConfig[] {
    return TEACHER_IDS.map((id) => this.configs[id]);
  }

  areaFor(id: TeacherId): TeacherRouteArea {
    const config = this.configs[id];
    const index = this.areaIndex[id] % Math.max(1, config.patrolAreas.length);
    return TEACHER_ROUTES[config.patrolAreas[index]] ?? TEACHER_ROUTES.entrance;
  }

  routeFor(id: TeacherId): TeacherRouteArea {
    return this.areaFor(id);
  }

  /** Called when a teacher finishes a route loop. */
  advanceArea(id: TeacherId): TeacherRouteArea {
    const config = this.configs[id];
    this.routeLoops[id] += 1;
    if (config.patrolAreas.length > 1) {
      // Select a different valid destination each loop, but keep it random so
      // the faculty do not look like they are marching a fixed circuit.
      const current = this.areaIndex[id];
      let next = current;
      while (next === current) next = Math.floor(Math.random() * config.patrolAreas.length);
      this.areaIndex[id] = next;
    } else if (config.patrolAreas.length === 1) {
      this.areaIndex[id] = 0;
    }
    return this.areaFor(id);
  }

  routeLoop(id: TeacherId): number {
    return this.routeLoops[id];
  }

  configure(id: TeacherId, patch: TeacherConfigPatch): TeacherConfig {
    this.applyPatch(id, patch);
    if (patch.personality) {
      this.configs[id].personality = patch.personality;
    }
    return this.configs[id];
  }

  private applyPatch(id: TeacherId, patch: TeacherConfigPatch): void {
    if (!this.configs[id]) return;
    if (patch.personality && isTeacherPersonality(patch.personality)) {
      this.configs[id].personality = patch.personality;
    }
    if (Array.isArray(patch.patrolAreas)) {
      const areas = Array.from(new Set(patch.patrolAreas.filter(isTeacherPlace)));
      if (areas.length > 0) {
        this.configs[id].patrolAreas = areas;
        this.areaIndex[id] = 0;
      }
    }
    if (patch.gender === "male" || patch.gender === "female" || patch.gender === "unspecified") {
      this.configs[id].gender = patch.gender;
    }
    if (typeof patch.speed === "number" && Number.isFinite(patch.speed)) {
      this.configs[id].speed = Math.max(0.7, Math.min(1.8, patch.speed));
    }
  }
}
