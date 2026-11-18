import {
  MESS_MEAL_CHECKPOINTS,
  MESS_MEAL_DIFFICULTIES,
  MESS_MEAL_PICKUP,
  emptyMessMealSave,
  isMessMealDifficulty,
  messMealCheckpointsFor,
  type MessMealCheckpoint,
  type MessMealDifficulty,
  type MessMealSave,
  type MessMealStatus,
} from "../data/messMeal";
import type { MessMealView } from "../core/types";
import { TEACHER_CONFIGS, type TeacherId } from "../data/teachers";

export interface MessPerception {
  id: TeacherId;
  name: string;
  x: number;
  z: number;
  rotation: number;
  detectionRadius: number;
  lineOfSight: boolean;
}

export interface MessUpdateInput {
  playerX: number;
  playerZ: number;
  crouching: boolean;
  dt: number;
  teachers: MessPerception[];
}

function angleDelta(a: number, b: number): number {
  let value = a - b;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return Math.abs(value);
}

/**
 * MESS MEAL SNEAK is another shared-campus mode: teacher rigs, collisions,
 * line of sight, the Principal referral and the save file are all reused. This
 * class owns the meal, route checkpoints, difficulty and suspicion only.
 */
export class MessMealSystem {
  private data: MessMealSave = emptyMessMealSave();
  private checkpoints: MessMealCheckpoint[] = [];
  private exposed = false;
  private caughtName: string | null = null;
  private returnPoint = { x: -18, z: 36.8, label: "Your hostel" };

  constructor(saved?: MessMealSave) {
    if (!saved) return;
    const difficulty = isMessMealDifficulty(saved.difficulty) ? saved.difficulty : "normal";
    const checkpointIds = Array.isArray(saved.checkpointIds)
      ? saved.checkpointIds.filter((id) =>
          MESS_MEAL_CHECKPOINTS.some((checkpoint) => checkpoint.id === id),
        )
      : [];
    const completedCheckpointIds = Array.isArray(saved.completedCheckpointIds)
      ? saved.completedCheckpointIds.filter((id) => checkpointIds.includes(id))
      : [];
    const status: MessMealStatus =
      saved.status === "return" ||
      saved.status === "caught" ||
      saved.status === "completed" ||
      saved.status === "failed" ||
      saved.status === "ended"
        ? saved.status
        : "to-mess";
    const active =
      saved.active === true &&
      status !== "completed" &&
      status !== "failed" &&
      status !== "ended";
    this.data = {
      active,
      difficulty,
      status: active
        ? status
        : saved.status === "completed"
          ? "completed"
          : saved.status === "failed"
            ? "failed"
            : "ended",
      mealCollected: saved.mealCollected === true,
      checkpointIds,
      completedCheckpointIds,
      suspicion: Math.max(0, Math.min(99, Math.round(Number(saved.suspicion) || 0))),
      caughtBy: saved.caughtBy ?? null,
      completedOnce: saved.completedOnce === true,
      resultSeen: saved.resultSeen !== false,
    };
    this.checkpoints = messMealCheckpointsFor(difficulty, checkpointIds);
    if (this.data.caughtBy) {
      this.caughtName = TEACHER_CONFIGS[this.data.caughtBy]?.name ?? null;
      this.exposed = this.data.status === "caught";
    }
  }

  get isActive(): boolean {
    return this.data.active;
  }

  get difficulty(): MessMealDifficulty {
    return this.data.difficulty;
  }

  get teacherIds(): TeacherId[] {
    return MESS_MEAL_DIFFICULTIES[this.data.difficulty].teachers;
  }

  get teacherSpeed(): number {
    return MESS_MEAL_DIFFICULTIES[this.data.difficulty].teacherSpeed;
  }

  get mealCollected(): boolean {
    return this.data.mealCollected;
  }

  get status(): MessMealStatus {
    return this.data.status;
  }

  setReturnPoint(x: number, z: number, label: string): void {
    this.returnPoint = { x, z, label };
  }

  start(difficulty: MessMealDifficulty): void {
    this.checkpoints = messMealCheckpointsFor(difficulty);
    this.data = {
      active: true,
      difficulty,
      status: "to-mess",
      mealCollected: false,
      checkpointIds: this.checkpoints.map((checkpoint) => checkpoint.id),
      completedCheckpointIds: [],
      suspicion: 0,
      caughtBy: null,
      completedOnce: this.data.completedOnce,
      resultSeen: false,
    };
    this.exposed = false;
    this.caughtName = null;
  }

  update(input: MessUpdateInput): TeacherId | null {
    if (!this.data.active) return null;
    if (
      this.data.status === "caught" ||
      this.data.status === "completed" ||
      this.data.status === "failed" ||
      this.data.status === "ended"
    ) {
      return null;
    }
    const config = MESS_MEAL_DIFFICULTIES[this.data.difficulty];

    if (this.data.status === "to-mess") {
      for (const checkpoint of this.checkpoints) {
        if (this.data.completedCheckpointIds.includes(checkpoint.id)) continue;
        if (
          Math.hypot(input.playerX - checkpoint.x, input.playerZ - checkpoint.z) <=
          checkpoint.radius
        ) {
          this.data.completedCheckpointIds.push(checkpoint.id);
        }
      }
    }

    let seenBy: MessPerception | null = null;
    let strongest = 0;
    let seenCount = 0;
    for (const teacher of input.teachers) {
      const dx = input.playerX - teacher.x;
      const dz = input.playerZ - teacher.z;
      const distance = Math.hypot(dx, dz);
      const radius = teacher.detectionRadius * config.detectionRadius;
      if (!teacher.lineOfSight || distance > radius) continue;
      const facing = angleDelta(Math.atan2(dx, dz), teacher.rotation);
      const inCone = facing < Math.PI * 0.44;
      const veryClose = distance < 2.8;
      if (!inCone && !veryClose) continue;
      seenCount += 1;
      const proximity = 1 - distance / Math.max(radius, 0.001);
      const threat = (inCone ? 0.75 : 0.42) + proximity * 0.8;
      if (threat > strongest) {
        strongest = threat;
        seenBy = teacher;
      }
    }

    this.exposed = Boolean(seenBy);
    if (seenBy) {
      const crouchFactor = input.crouching ? 0.4 : 1;
      const extraEyes = Math.min(0.8, (seenCount - 1) * 0.22);
      const rate =
        (13 + strongest * 47 + extraEyes * 25) * config.detectionSpeed * crouchFactor;
      this.data.suspicion = Math.min(100, this.data.suspicion + rate * input.dt);
    } else {
      this.data.suspicion = Math.max(0, this.data.suspicion - 9.5 * input.dt);
    }

    if (this.data.suspicion >= 100 && seenBy) {
      this.data.status = "caught";
      this.data.caughtBy = seenBy.id;
      this.caughtName = seenBy.name;
      return seenBy.id;
    }

    if (
      this.data.status === "return" &&
      Math.hypot(input.playerX - this.returnPoint.x, input.playerZ - this.returnPoint.z) <= 3.2
    ) {
      this.complete();
    }

    return null;
  }

  canCollectMeal(): boolean {
    if (!this.data.active || this.data.status !== "to-mess" || this.data.mealCollected) {
      return false;
    }
    return this.checkpoints.every((checkpoint) =>
      this.data.completedCheckpointIds.includes(checkpoint.id),
    );
  }

  missingRouteLabel(): string | null {
    const next = this.checkpoints.find(
      (checkpoint) => !this.data.completedCheckpointIds.includes(checkpoint.id),
    );
    return next ? next.label : null;
  }

  collectMeal(): { ok: boolean; reason?: string } {
    if (!this.data.active || this.data.status !== "to-mess") {
      return { ok: false, reason: "The meal is not the objective right now." };
    }
    if (this.data.mealCollected) {
      return { ok: false, reason: "You already have the meal." };
    }
    if (!this.canCollectMeal()) {
      const missing = this.missingRouteLabel();
      return {
        ok: false,
        reason: missing ? `Stay on the night route: ${missing}.` : "The counter is not clear yet.",
      };
    }
    this.data.mealCollected = true;
    this.data.status = "return";
    this.data.suspicion = Math.min(35, this.data.suspicion);
    return { ok: true };
  }

  markCaught(teacherId: TeacherId, teacherName: string): void {
    if (!this.data.active) return;
    this.data.status = "caught";
    this.data.caughtBy = teacherId;
    this.data.suspicion = 100;
    this.caughtName = teacherName;
    this.exposed = true;
  }

  /** Principal lets the student continue with the meal exactly as it was. */
  resumeAfterCaught(): void {
    this.data.active = true;
    this.data.status = this.data.mealCollected ? "return" : "to-mess";
    this.data.caughtBy = null;
    this.data.suspicion = Math.min(30, this.data.suspicion);
    this.caughtName = null;
    this.exposed = false;
  }

  /** Principal closes the attempt; the collected meal state is preserved. */
  endAfterCaught(): void {
    this.finish("ended");
  }

  /** Leaving the Principal's Chamber with the meal counts as reaching safety. */
  finishAfterPrincipalReturning(): void {
    if (this.data.mealCollected) {
      this.complete();
    } else {
      this.finish("failed");
    }
  }

  complete(): void {
    this.finish("completed");
  }

  finish(outcome: "completed" | "failed" | "ended"): void {
    this.data.status = outcome;
    this.data.active = false;
    this.data.resultSeen = false;
    this.data.suspicion = outcome === "completed" ? 0 : this.data.suspicion;
    this.data.caughtBy = outcome === "completed" ? null : this.data.caughtBy;
    if (outcome === "completed") this.data.completedOnce = true;
    this.exposed = false;
  }

  dismissResult(): void {
    this.data.active = false;
    this.data.resultSeen = true;
  }

  close(): void {
    this.data.active = false;
    this.data.suspicion = 0;
    this.data.caughtBy = null;
    this.caughtName = null;
    this.exposed = false;
  }

  view(): MessMealView {
    const config = MESS_MEAL_DIFFICULTIES[this.data.difficulty];
    const objectives = [
      ...this.checkpoints.map((checkpoint) => ({
        id: `route-${checkpoint.id}`,
        label: checkpoint.label,
        complete: this.data.completedCheckpointIds.includes(checkpoint.id),
      })),
      {
        id: "meal",
        label: "Collect food from the serving counter",
        complete: this.data.mealCollected,
      },
      {
        id: "hostel",
        label: `Return to ${this.returnPoint.label}`,
        complete: this.data.status === "completed",
      },
    ];
    const target = this.targetPoint();
    return {
      active: this.data.active,
      difficulty: this.data.difficulty,
      difficultyLabel: config.label,
      status: this.data.status,
      mealCollected: this.data.mealCollected,
      objectives,
      completed: objectives.filter((objective) => objective.complete).length,
      total: objectives.length,
      suspicion: this.data.status === "caught" ? 100 : Math.round(this.data.suspicion),
      exposed: this.exposed || this.data.status === "caught",
      caughtBy:
        this.caughtName ??
        (this.data.caughtBy ? TEACHER_CONFIGS[this.data.caughtBy]?.name ?? null : null),
      target,
      result:
        this.data.resultSeen
          ? null
          : this.data.status === "completed"
            ? {
                outcome: "completed",
                title: "MISSION COMPLETED",
                message:
                  "You made it back with the food. Your roommates gather around the table, laughing too loudly for lights-out.",
              }
            : this.data.status === "failed"
              ? {
                  outcome: "failed",
                  title: "EMPTY-HANDED",
                  message:
                    "You returned to the hostel without the meal. The beds are quiet, but the hunger is not.",
                }
              : this.data.status === "ended"
                ? {
                    outcome: "ended",
                    title: "MESS MEAL SNEAK ENDED",
                    message:
                      "Principal Moinm Rahman closed the matter. Your meal and mission progress remain on record.",
                  }
                : null,
      completedOnce: this.data.completedOnce,
    };
  }

  toSave(): MessMealSave {
    return {
      ...this.data,
      checkpointIds: [...this.data.checkpointIds],
      completedCheckpointIds: [...this.data.completedCheckpointIds],
    };
  }

  targetPoint(): { x: number; z: number; label: string } | null {
    if (!this.data.active || this.data.status === "caught") return null;
    if (this.data.status === "return") {
      return {
        x: this.returnPoint.x,
        z: this.returnPoint.z,
        label: this.returnPoint.label,
      };
    }
    if (this.data.status !== "to-mess") return null;
    const next = this.checkpoints.find(
      (checkpoint) => !this.data.completedCheckpointIds.includes(checkpoint.id),
    );
    if (next) return { x: next.x, z: next.z, label: next.area };
    if (!this.data.mealCollected) return { ...MESS_MEAL_PICKUP };
    return null;
  }
}
