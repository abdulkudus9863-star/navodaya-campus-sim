import {
  CLASS_BUNK_CAUGHT_LINE,
  CLASS_BUNK_DIFFICULTIES,
  CLASS_BUNK_OBJECTIVES,
  CLASS_BUNK_RETURN,
  CLASS_BUNK_START,
  classBunkObjectivesFor,
  emptyClassBunkSave,
  isClassBunkDifficulty,
  type ClassBunkDifficulty,
  type ClassBunkObjective,
  type ClassBunkSave,
} from "../data/classBunk";
import type { ClassBunkView } from "../core/types";
import type { TeacherId } from "../data/teachers";

export interface BunkPerception {
  id: TeacherId;
  name: string;
  x: number;
  z: number;
  rotation: number;
  detectionRadius: number;
  lineOfSight: boolean;
}

export interface BunkUpdateInput {
  playerX: number;
  playerZ: number;
  crouching: boolean;
  dt: number;
  teachers: BunkPerception[];
}

function angleDelta(a: number, b: number): number {
  let value = a - b;
  while (value > Math.PI) value -= Math.PI * 2;
  while (value < -Math.PI) value += Math.PI * 2;
  return Math.abs(value);
}

/**
 * CLASS BUNK is a mode over the existing campus rather than a separate scene.
 * It owns only time, objectives, suspicion and the result; teacher movement,
 * detection geometry, collisions, the timetable and saves stay shared.
 */
export class ClassBunkSystem {
  private data: ClassBunkSave = emptyClassBunkSave();
  private objectives: ClassBunkObjective[] = [];
  private exposed = false;
  private caughtName: string | null = null;

  constructor(saved?: ClassBunkSave) {
    if (!saved) return;
    const difficulty = isClassBunkDifficulty(saved.difficulty) ? saved.difficulty : "normal";
    const objectiveIds = Array.isArray(saved.objectiveIds)
      ? saved.objectiveIds.filter((id) =>
          CLASS_BUNK_OBJECTIVES.some((objective) => objective.id === id),
        )
      : [];
    const completedIds = Array.isArray(saved.completedIds)
      ? saved.completedIds.filter((id) => objectiveIds.includes(id))
      : [];
    const status =
      saved.status === "return" ||
      saved.status === "caught" ||
      saved.status === "completed" ||
      saved.status === "failed" ||
      saved.status === "ended"
        ? saved.status
        : "exploring";
    const active =
      saved.active === true &&
      status !== "completed" &&
      status !== "failed" &&
      status !== "ended";
    this.data = {
      active,
      difficulty,
      objectiveIds,
      completedIds,
      remaining: Math.max(0, Math.min(600, Math.round(Number(saved.remaining) || 0))),
      suspicion: Math.max(0, Math.min(99, Math.round(Number(saved.suspicion) || 0))),
      status: active
        ? status
        : saved.status === "completed"
          ? "completed"
          : saved.status === "failed"
            ? "failed"
            : "ended",
      caughtBy: saved.caughtBy ?? null,
      completedOnce: saved.completedOnce === true,
      resultSeen: saved.resultSeen !== false,
    };
    this.objectives = classBunkObjectivesFor(difficulty, objectiveIds);
  }

  get isActive(): boolean {
    return this.data.active;
  }

  get difficulty(): ClassBunkDifficulty {
    return this.data.difficulty;
  }

  get teacherIds(): TeacherId[] {
    return CLASS_BUNK_DIFFICULTIES[this.data.difficulty].teachers;
  }

  get startPoint() {
    return CLASS_BUNK_START;
  }

  get caughtLine(): string {
    return CLASS_BUNK_CAUGHT_LINE;
  }

  start(difficulty: ClassBunkDifficulty): void {
    const config = CLASS_BUNK_DIFFICULTIES[difficulty];
    this.objectives = classBunkObjectivesFor(difficulty);
    this.data = {
      active: true,
      difficulty,
      objectiveIds: this.objectives.map((objective) => objective.id),
      completedIds: [],
      remaining: config.seconds,
      suspicion: 0,
      status: "exploring",
      caughtBy: null,
      completedOnce: this.data.completedOnce,
      resultSeen: false,
    };
    this.exposed = false;
    this.caughtName = null;
  }

  update(input: BunkUpdateInput): TeacherId | null {
    if (!this.data.active) return null;
    if (this.data.status === "caught" || this.data.status === "completed" || this.data.status === "failed") {
      return null;
    }
    const config = CLASS_BUNK_DIFFICULTIES[this.data.difficulty];
    this.data.remaining = Math.max(0, this.data.remaining - input.dt);
    if (this.data.remaining <= 0) {
      this.finish("failed");
      return null;
    }

    let seenBy: BunkPerception | null = null;
    let strongest = 0;
    let seenCount = 0;
    for (const teacher of input.teachers) {
      const dx = input.playerX - teacher.x;
      const dz = input.playerZ - teacher.z;
      const distance = Math.hypot(dx, dz);
      const radius = teacher.detectionRadius * config.detectionRadius;
      if (!teacher.lineOfSight || distance > radius) continue;
      // Teachers see a wide cone ahead and a short awareness ring around them.
      const facing = angleDelta(Math.atan2(dx, dz), teacher.rotation);
      const inCone = facing < Math.PI * 0.46;
      const veryClose = distance < 3.1;
      if (!inCone && !veryClose) continue;
      seenCount += 1;
      const proximity = 1 - distance / Math.max(radius, 0.001);
      const threat = (inCone ? 0.7 : 0.4) + proximity * 0.8;
      if (threat > strongest) {
        strongest = threat;
        seenBy = teacher;
      }
    }

    this.exposed = Boolean(seenBy);
    if (seenBy) {
      const crouchFactor = input.crouching ? 0.42 : 1;
      const extraEyes = Math.min(0.8, (seenCount - 1) * 0.2);
      const rate = (11 + strongest * 42 + extraEyes * 24) * config.detectionSpeed * crouchFactor;
      this.data.suspicion = Math.min(100, this.data.suspicion + rate * input.dt);
    } else {
      this.data.suspicion = Math.max(0, this.data.suspicion - 8.5 * input.dt);
    }

    if (this.data.suspicion >= 100 && seenBy) {
      this.data.status = "caught";
      this.data.caughtBy = seenBy.id;
      this.caughtName = seenBy.name;
      return seenBy.id;
    }

    const inClass = Math.hypot(
      input.playerX - CLASS_BUNK_RETURN.x,
      input.playerZ - CLASS_BUNK_RETURN.z,
    ) <= CLASS_BUNK_RETURN.radius;

    if (this.data.status === "exploring") {
      for (const objective of this.objectives) {
        if (this.data.completedIds.includes(objective.id)) continue;
        if (Math.hypot(input.playerX - objective.x, input.playerZ - objective.z) <= objective.radius) {
          this.data.completedIds.push(objective.id);
        }
      }
      if (this.data.completedIds.length >= this.objectives.length) {
        this.data.status = "return";
      }
    }

    if (this.data.status === "return" && inClass) {
      this.finish("completed");
    }

    return null;
  }

  /** Development/test hook: reach the same caught state as a real sighting. */
  markCaught(teacherId: TeacherId, teacherName: string): void {
    if (!this.data.active) return;
    this.data.status = "caught";
    this.data.caughtBy = teacherId;
    this.data.suspicion = 100;
    this.caughtName = teacherName;
    this.exposed = true;
  }

  /** Principal lets the student continue the attempt after a referral. */
  resumeAfterCaught(): void {
    this.data.active = true;
    this.data.status = this.data.completedIds.length >= this.objectives.length ? "return" : "exploring";
    this.data.caughtBy = null;
    this.data.suspicion = Math.min(30, this.data.suspicion);
    this.caughtName = null;
  }

  /** Principal ends the attempt. Progress already completed is preserved. */
  endAfterCaught(): void {
    this.finish("ended");
  }

  finish(outcome: "completed" | "failed" | "ended"): void {
    this.data.status = outcome;
    this.data.active = false;
    this.data.resultSeen = false;
    this.data.suspicion = outcome === "completed" ? 0 : this.data.suspicion;
    this.data.caughtBy = outcome === "completed" ? null : this.data.caughtBy;
    if (outcome === "completed") this.data.completedOnce = true;
  }

  /** Called when the player closes the result overlay. */
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

  view(): ClassBunkView {
    const config = CLASS_BUNK_DIFFICULTIES[this.data.difficulty];
    const completed = this.objectives.filter((objective) =>
      this.data.completedIds.includes(objective.id),
    ).length;
    return {
      active: this.data.active,
      difficulty: this.data.difficulty,
      difficultyLabel: config.label,
      status: this.data.status,
      secondsLeft: Math.ceil(this.data.remaining),
      objectives: this.objectives.map((objective) => ({
        id: objective.id,
        label: objective.label,
        area: objective.area,
        x: objective.x,
        z: objective.z,
        complete: this.data.completedIds.includes(objective.id),
      })),
      completed,
      total: this.objectives.length,
      suspicion: Math.round(this.data.suspicion),
      exposed: this.exposed,
      caughtBy: this.caughtName,
      result:
        this.data.resultSeen
          ? null
          : this.data.status === "completed"
          ? {
              outcome: "completed",
              title: "MISSION COMPLETED",
              message:
                "All stops covered and attendance restored before the bell. Nobody can prove a thing.",
            }
          : this.data.status === "failed"
            ? {
                outcome: "failed",
                title: "THE BELL CAUGHT YOU",
                message:
                  "Class ended while you were out. Your completed stops were kept, but the register tells its own story.",
              }
            : this.data.status === "ended"
              ? {
                  outcome: "ended",
                  title: "CLASS BUNK ENDED",
                  message:
                    "Principal Moinm Rahman closed the matter. Your completed stops remain on record.",
                }
              : null,
      completedOnce: this.data.completedOnce,
    };
  }

  toSave(): ClassBunkSave {
    return {
      ...this.data,
      objectiveIds: [...this.data.objectiveIds],
      completedIds: [...this.data.completedIds],
    };
  }

  /** Serialised view for the next objective, or the classroom on the way back. */
  targetPoint(): { x: number; z: number; label: string } | null {
    if (!this.data.active) return null;
    if (this.data.status === "return") {
      return { x: CLASS_BUNK_RETURN.x, z: CLASS_BUNK_RETURN.z, label: "Room 101" };
    }
    const next = this.objectives.find(
      (objective) => !this.data.completedIds.includes(objective.id),
    );
    return next ? { x: next.x, z: next.z, label: next.area } : null;
  }
}
