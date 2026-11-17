import type {
  TeacherMemory,
  TeacherMemoryEntry,
  TeacherSave,
} from "../core/types";
import {
  TEACHER_IDS,
  emptyTeacherMemory,
  emptyTeacherSave,
  isTeacherId,
  type TeacherId,
} from "../data/teachers";
import { StudentReputationManager } from "./StudentReputationManager";

const COOLDOWN_MS = 38_000;
const MAX_HISTORY = 10;

/**
 * Teacher-specific memory and the shared conduct record. All values are
 * clamped/sanitised when loaded because local storage is editable.
 */
export class TeacherMemoryManager {
  private data: TeacherSave;
  private reputationRecord: StudentReputationManager;

  constructor(save?: TeacherSave) {
    this.data = this.sanitize(save);
    this.reputationRecord = new StudentReputationManager(this.data.reputation);
  }

  toSave(): TeacherSave {
    return {
      reputation: this.reputationRecord.reputation,
      memories: Object.fromEntries(
        Object.entries(this.data.memories).map(([id, memory]) => [
          id,
          {
            ...memory,
            history: memory.history.map((entry) => ({ ...entry })),
          },
        ]),
      ),
      discipline: { ...this.data.discipline },
      cooldowns: { ...this.data.cooldowns },
    };
  }

  reset(): void {
    this.data = emptyTeacherSave();
    this.reputationRecord = new StudentReputationManager(this.data.reputation);
  }

  memoryFor(id: TeacherId): TeacherMemory {
    if (!this.data.memories[id]) this.data.memories[id] = emptyTeacherMemory();
    return this.data.memories[id];
  }

  get reputation(): number {
    return this.reputationRecord.reputation;
  }

  set reputation(value: number) {
    this.reputationRecord.reputation = value;
  }

  reputationLabel(): string {
    return this.reputationRecord.label;
  }

  warningsFor(id: TeacherId): number {
    return this.memoryFor(id).warnings;
  }

  totalWarnings(): number {
    return Object.values(this.data.memories).reduce((sum, memory) => sum + memory.warnings, 0);
  }

  encountersFor(id: TeacherId): number {
    return this.memoryFor(id).encounters;
  }

  canEncounter(id: TeacherId, now = Date.now()): boolean {
    const cooldown = this.data.cooldowns[id] ?? 0;
    return now >= cooldown;
  }

  cooldownRemaining(id: TeacherId, now = Date.now()): number {
    return Math.max(0, (this.data.cooldowns[id] ?? 0) - now);
  }

  startCooldown(id: TeacherId, milliseconds = COOLDOWN_MS, now = Date.now()): void {
    this.data.cooldowns[id] = now + milliseconds;
    // Do not let stale cooldowns grow without bound.
    for (const [key, until] of Object.entries(this.data.cooldowns)) {
      if (until < now - 86_400_000) delete this.data.cooldowns[key];
    }
  }

  record(input: {
    teacherId: TeacherId;
    question: string;
    reply: string;
    outcome: TeacherMemoryEntry["outcome"];
    warned: boolean;
    reputationDelta: number;
    now?: number;
  }): TeacherMemoryEntry {
    const now = input.now ?? Date.now();
    const memory = this.memoryFor(input.teacherId);
    memory.encounters += 1;
    if (input.warned) memory.warnings += 1;
    memory.lastSeenAt = now;
    memory.lastQuestion = input.question;
    memory.lastOutcome = input.outcome;
    const entry: TeacherMemoryEntry = {
      at: now,
      encounter: memory.encounters,
      question: input.question,
      reply: input.reply,
      outcome: input.outcome,
      warned: input.warned,
    };
    memory.history = [entry, ...memory.history].slice(0, MAX_HISTORY);
    this.reputationRecord.add(input.reputationDelta);
    return entry;
  }

  disciplineActive(now = Date.now()): boolean {
    return (
      this.data.discipline.active &&
      this.data.discipline.task !== null &&
      now < this.data.discipline.deadlineAt
    );
  }

  startDiscipline(input: {
    teacherId: TeacherId;
    now?: number;
    durationMs?: number;
  }): void {
    const now = input.now ?? Date.now();
    this.data.discipline = {
      active: true,
      teacherId: input.teacherId,
      task: "return-hostel",
      startedAt: now,
      deadlineAt: now + (input.durationMs ?? 120_000),
    };
  }

  completeDiscipline(): number {
    if (!this.data.discipline.active) return 0;
    const teacherId = this.data.discipline.teacherId;
    this.data.discipline = {
      active: false,
      teacherId,
      task: null,
      startedAt: 0,
      deadlineAt: 0,
    };
    const memory = this.memoryFor(isTeacherId(teacherId) ? teacherId : "dinesh");
    memory.lastOutcome = "positive";
    this.reputationRecord.add(3);
    return 3;
  }

  cancelDiscipline(): void {
    this.data.discipline = {
      active: false,
      teacherId: this.data.discipline.teacherId,
      task: null,
      startedAt: 0,
      deadlineAt: 0,
    };
  }

  /** Called if the task expires. Never teleports or removes progress. */
  failDiscipline(): { teacherId: TeacherId; delta: number } | null {
    if (!this.data.discipline.active) return null;
    const teacherId = isTeacherId(this.data.discipline.teacherId)
      ? this.data.discipline.teacherId
      : "dinesh";
    this.data.discipline = {
      active: false,
      teacherId,
      task: null,
      startedAt: 0,
      deadlineAt: 0,
    };
    this.reputationRecord.add(-4);
    this.memoryFor(teacherId).warnings += 1;
    return { teacherId, delta: -4 };
  }

  private sanitize(raw?: TeacherSave): TeacherSave {
    const fallback = emptyTeacherSave();
    if (!raw || typeof raw !== "object") return fallback;
    const memories: Record<string, TeacherMemory> = {};
    for (const id of TEACHER_IDS) {
      const source = raw.memories?.[id];
      if (!source || typeof source !== "object") {
        memories[id] = emptyTeacherMemory();
        continue;
      }
      const history = Array.isArray(source.history)
        ? source.history.slice(0, MAX_HISTORY).flatMap((entry) => {
            if (!entry || typeof entry !== "object") return [];
            const validOutcomes: TeacherMemoryEntry["outcome"][] = [
              "positive",
              "neutral",
              "warning",
              "disciplined",
            ];
            if (!validOutcomes.includes(entry.outcome)) return [];
            return [
              {
                at: Math.max(0, Number(entry.at) || 0),
                encounter: Math.max(0, Math.floor(Number(entry.encounter) || 0)),
                question: typeof entry.question === "string" ? entry.question.slice(0, 180) : "",
                reply: typeof entry.reply === "string" ? entry.reply.slice(0, 180) : "",
                outcome: entry.outcome,
                warned: entry.warned === true,
              },
            ];
          })
        : [];
      memories[id] = {
        encounters: Math.max(0, Math.min(9_999, Math.floor(Number(source.encounters) || 0))),
        warnings: Math.max(0, Math.min(999, Math.floor(Number(source.warnings) || 0))),
        lastSeenAt: Math.max(0, Number(source.lastSeenAt) || 0),
        lastQuestion: typeof source.lastQuestion === "string" ? source.lastQuestion.slice(0, 180) : null,
        lastOutcome:
          source.lastOutcome === "positive" ||
          source.lastOutcome === "neutral" ||
          source.lastOutcome === "warning" ||
          source.lastOutcome === "disciplined"
            ? source.lastOutcome
            : null,
        history,
      };
    }
    const cooldowns: Record<string, number> = {};
    for (const id of TEACHER_IDS) {
      const value = Number(raw.cooldowns?.[id]);
      if (Number.isFinite(value) && value > 0) cooldowns[id] = value;
    }
    const disciplineSource = raw.discipline;
    const discipline =
      disciplineSource && typeof disciplineSource === "object"
        ? {
            active: disciplineSource.active === true,
            teacherId: isTeacherId(disciplineSource.teacherId)
              ? disciplineSource.teacherId
              : "dinesh",
            task: disciplineSource.task === "return-hostel" ? ("return-hostel" as const) : null,
            startedAt: Math.max(0, Number(disciplineSource.startedAt) || 0),
            deadlineAt: Math.max(0, Number(disciplineSource.deadlineAt) || 0),
          }
        : fallback.discipline;
    return {
      reputation: Math.max(0, Math.min(100, Math.round(Number(raw.reputation) || fallback.reputation))),
      memories,
      discipline,
      cooldowns,
    };
  }
}
