import {
  MISSION_STEPS,
  MISSION_TITLE,
  type MissionSave,
  type MissionView,
} from "../core/types";

export class MissionSystem {
  stepIndex = 0;
  completed: string[] = [];
  done = false;
  started = false;
  houseName = "your house";

  setHouseName(name: string): void {
    this.houseName = name || "your house";
  }

  onStepComplete: ((stepId: string, allDone: boolean) => void) | null = null;

  startNew(): MissionView {
    this.stepIndex = 0;
    this.completed = [];
    this.done = false;
    this.started = true;
    return this.view();
  }

  restore(save: MissionSave): MissionView {
    this.completed = [...save.completed];
    this.done = save.completed.length >= MISSION_STEPS.length;
    this.stepIndex = this.done
      ? MISSION_STEPS.length
      : Math.min(MISSION_STEPS.length - 1, Math.max(0, save.step));
    this.started = save.started;
    return this.view();
  }

  get currentStepId(): string | null {
    if (this.done) return null;
    return MISSION_STEPS[this.stepIndex]?.id ?? null;
  }

  view(): MissionView {
    if (this.done) {
      return {
        title: MISSION_TITLE,
        objective: "Day one complete — explore the campus",
        hint: "Meera is still by the gate. The dining hall bell rings before dark.",
        step: MISSION_STEPS.length,
        total: MISSION_STEPS.length,
        completed: [...this.completed],
        done: true,
      };
    }
    const step = MISSION_STEPS[this.stepIndex];
    return {
      title: MISSION_TITLE,
      objective:
        step.id === "hostel" ? `Enter ${this.houseName} Hostel` : step.objective,
      hint:
        step.id === "hostel"
          ? `${this.houseName} stands on the south lawn. Its flag and door carry the house colours.`
          : step.hint,
      step: this.stepIndex,
      total: MISSION_STEPS.length,
      completed: [...this.completed],
      done: false,
    };
  }

  /** Completes a specific objective only when it is the active one. */
  completeStep(stepId: string): { changed: boolean; allDone: boolean } {
    if (this.done) return { changed: false, allDone: true };
    const active = this.currentStepId;
    if (active !== stepId) return { changed: false, allDone: false };
    this.completed.push(stepId);
    this.stepIndex = Math.min(MISSION_STEPS.length, this.stepIndex + 1);
    this.done = this.completed.length >= MISSION_STEPS.length;
    this.onStepComplete?.(stepId, this.done);
    return { changed: true, allDone: this.done };
  }

  toSave(): MissionSave {
    return {
      started: this.started,
      step: this.stepIndex,
      completed: [...this.completed],
    };
  }
}
