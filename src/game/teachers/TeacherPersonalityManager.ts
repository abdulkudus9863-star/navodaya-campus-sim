import type { TeacherPersonalityId } from "../core/types";
import { PERSONALITY_LABELS } from "../data/teachers";

export interface PersonalityProfile {
  label: string;
  patience: number;
  warningThreshold: number;
  allowsExcuse: boolean;
  gesture: "folded" | "open" | "measured" | "lively" | "neutral";
  reactionStyle: string;
}

const PROFILES: Record<TeacherPersonalityId, PersonalityProfile> = {
  strict: {
    label: PERSONALITY_LABELS.strict,
    patience: 0.25,
    warningThreshold: 1,
    allowsExcuse: false,
    gesture: "folded",
    reactionStyle: "direct, clipped and focused on the rule",
  },
  friendly: {
    label: PERSONALITY_LABELS.friendly,
    patience: 0.85,
    warningThreshold: 3,
    allowsExcuse: true,
    gesture: "open",
    reactionStyle: "warm, encouraging and quick to offer help",
  },
  serious: {
    label: PERSONALITY_LABELS.serious,
    patience: 0.55,
    warningThreshold: 2,
    allowsExcuse: true,
    gesture: "measured",
    reactionStyle: "measured, factual and focused on responsibility",
  },
  funny: {
    label: PERSONALITY_LABELS.funny,
    patience: 0.72,
    warningThreshold: 3,
    allowsExcuse: true,
    gesture: "lively",
    reactionStyle: "light, observant and gently teasing",
  },
  neutral: {
    label: PERSONALITY_LABELS.neutral,
    patience: 0.6,
    warningThreshold: 2,
    allowsExcuse: true,
    gesture: "neutral",
    reactionStyle: "balanced and observant",
  },
};

export class TeacherPersonalityManager {
  profile(id: TeacherPersonalityId): PersonalityProfile {
    return PROFILES[id] ?? PROFILES.neutral;
  }

  shouldWarn(input: {
    personality: TeacherPersonalityId;
    disrespectful: boolean;
    incorrect: boolean;
    timetableViolation: boolean;
    warnings: number;
  }): boolean {
    const profile = this.profile(input.personality);
    if (input.disrespectful) return true;
    if (!input.timetableViolation) return false;
    if (input.incorrect) return profile.allowsExcuse ? input.warnings >= 1 : true;
    return input.warnings >= profile.warningThreshold;
  }

  reputationDelta(input: {
    personality: TeacherPersonalityId;
    respectful: boolean;
    correct: boolean;
    disrespectful: boolean;
    warned: boolean;
  }): number {
    const profile = this.profile(input.personality);
    if (input.disrespectful) return -9;
    if (input.warned) return -4;
    if (input.respectful && input.correct) return Math.round(4 + profile.patience * 2);
    if (input.respectful) return 2;
    if (input.correct) return 1;
    return -2;
  }
}
