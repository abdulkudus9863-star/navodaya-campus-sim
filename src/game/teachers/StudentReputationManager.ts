/**
 * Shared conduct score for the player. Teachers read and change this one
 * record, so a warning from Dinesh is visible to every member of staff.
 */
export class StudentReputationManager {
  private score: number;

  constructor(initial = 68) {
    this.score = this.clamp(initial);
  }

  get reputation(): number {
    return this.score;
  }

  set reputation(value: number) {
    this.score = this.clamp(value);
  }

  add(delta: number): number {
    this.score = this.clamp(this.score + delta);
    return this.score;
  }

  get label(): string {
    if (this.score >= 82) return "Trusted";
    if (this.score >= 64) return "Steady";
    if (this.score >= 45) return "Needs care";
    return "Under watch";
  }

  private clamp(value: number): number {
    if (!Number.isFinite(value)) return 68;
    return Math.max(0, Math.min(100, Math.round(value)));
  }
}
