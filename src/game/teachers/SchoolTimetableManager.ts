import { TIMETABLE, type TimetablePeriod } from "../data/teachers";
import type { TeacherAreaId, TimetablePhaseId } from "../core/types";

const START_MINUTE = 16 * 60;
const GAME_MINUTES_PER_SECOND = 0.5;

export interface SchoolTime {
  minuteOfDay: number;
  clock: string;
  period: TimetablePeriod;
  phase: TimetablePhaseId;
  label: string;
}

function wrapMinute(minute: number): number {
  return ((minute % 1440) + 1440) % 1440;
}

function formatClock(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60) % 24;
  const minute = Math.floor(minuteOfDay % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function contains(period: TimetablePeriod, minute: number): boolean {
  if (period.startMinute === period.endMinute) return true;
  if (period.endMinute > period.startMinute) {
    return minute >= period.startMinute && minute < period.endMinute;
  }
  return minute >= period.startMinute || minute < period.endMinute;
}

/**
 * Accelerated school timetable. It starts at 16:00 so the first session is
 * games duty, then advances through prep, dinner and hostel hours. Tests and
 * scripted sequences can pin a period without touching the save format.
 */
export class SchoolTimetableManager {
  private pinned: TimetablePhaseId | null = null;

  setPinned(phase: TimetablePhaseId | null): void {
    this.pinned = phase;
  }

  get pinnedPhase(): TimetablePhaseId | null {
    return this.pinned;
  }

  at(playtimeSeconds: number): SchoolTime {
    const minuteOfDay = wrapMinute(
      START_MINUTE + Math.max(0, playtimeSeconds) * GAME_MINUTES_PER_SECOND,
    );
    const pinnedPeriod = this.pinned
      ? TIMETABLE.find((entry) => entry.id === this.pinned)
      : undefined;
    const period =
      pinnedPeriod ??
      TIMETABLE.find((entry) => contains(entry, minuteOfDay)) ??
      TIMETABLE[0];
    return {
      minuteOfDay,
      clock: formatClock(pinnedPeriod ? pinnedPeriod.startMinute : minuteOfDay),
      period,
      phase: period.id,
      label: period.label,
    };
  }

  allows(phase: TimetablePhaseId, area: TeacherAreaId): boolean {
    const period = TIMETABLE.find((entry) => entry.id === phase);
    return period ? period.allowedAreas.includes(area) : true;
  }

  expectation(phase: TimetablePhaseId): string {
    return TIMETABLE.find((entry) => entry.id === phase)?.expectation ?? "Follow the school routine.";
  }
}
