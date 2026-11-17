import type {
  DialogueView,
  TeacherDialogueMeta,
  TeacherPersonalityId,
} from "../core/types";
import type {
  TeacherConfig,
  TeacherId,
} from "../data/teachers";
import type { StudentIdentity } from "./StudentIdentityManager";
import type { TeacherMemoryManager } from "./TeacherMemoryManager";
import type { TeacherPersonalityManager } from "./TeacherPersonalityManager";
import type { SchoolTime } from "./SchoolTimetableManager";
import { areaLabel } from "./TeacherDetectionSystem";
import type { TeacherAreaId } from "../core/types";

type Tone = "respectful" | "honest" | "excuse" | "disrespectful";

interface DialogueChoiceSpec {
  label: string;
  next: string;
  tone: Tone;
  correct?: boolean;
  notice?: string;
}

interface DialogueNodeSpec {
  id: string;
  text: string;
  question: string;
  choices?: DialogueChoiceSpec[];
  next?: string;
  readonly?: boolean;
}

export interface TeacherDialogueContext {
  config: TeacherConfig;
  identity: StudentIdentity;
  area: TeacherAreaId;
  time: SchoolTime;
  violation: boolean;
  warningsBefore: number;
}

export interface TeacherChoiceResult {
  view: DialogueView;
  ended: boolean;
  warning: boolean;
  disciplineStarted: boolean;
  reputationDelta: number;
  notice: string | null;
  answer: string;
  principalReferral: boolean;
  referralReason: string | null;
}

const SUBJECT_QUESTIONS: Record<
  TeacherId,
  { question: string; correct: string; wrong: string[]; explanation: string }[]
> = {
  dinesh: [
    {
      question: "Quick one before you go — how many players from one football team are on the field at a time?",
      correct: "Eleven players, sir.",
      wrong: ["Nine players, sir.", "Ten players, sir.", "Twelve players, sir."],
      explanation: "Eleven. And the moment you stop counting, someone on the other side is making a run.",
    },
    {
      question: "In kabaddi, how long does a raider have for one raid?",
      correct: "Thirty seconds, sir.",
      wrong: ["Fifteen seconds, sir.", "Twenty seconds, sir.", "Forty-five seconds, sir."],
      explanation: "Thirty seconds. The clock is part of the skill; the lungs are the rest of it.",
    },
    {
      question: "Which fitness component does a 50-metre sprint test most directly?",
      correct: "Speed, sir.",
      wrong: ["Flexibility, sir.", "Endurance, sir.", "Balance, sir."],
      explanation: "Speed. Endurance is the long loop; do not confuse the two on the track.",
    },
  ],
  sushil: [
    {
      question: "In the Constitution, which Article abolishes untouchability?",
      correct: "Article 17, sir.",
      wrong: ["Article 14, sir.", "Article 19, sir.", "Article 21, sir."],
      explanation: "Article 17. Rights on paper matter only when ordinary behaviour catches up with them.",
    },
    {
      question: "Which soil is generally best suited to cotton?",
      correct: "Black soil, sir.",
      wrong: ["Alluvial soil, sir.", "Red soil, sir.", "Laterite soil, sir."],
      explanation: "Black soil retains moisture well and suits cotton — a useful detail when we discuss the Deccan.",
    },
    {
      question: "Which of these Indian states does the Tropic of Cancer pass through?",
      correct: "Gujarat, sir.",
      wrong: ["Kerala, sir.", "Tamil Nadu, sir.", "Odisha, sir."],
      explanation: "Gujarat. Take out the atlas tomorrow and trace the line properly.",
    },
  ],
  rahul: [
    {
      question: "What does GST stand for?",
      correct: "Goods and Services Tax, sir.",
      wrong: ["General Sales Tax, sir.", "Gross State Tax, sir.", "Government Service Tariff, sir."],
      explanation: "Goods and Services Tax. One indirect tax replacing a patchwork of others.",
    },
    {
      question: "Agriculture belongs to which sector of the economy?",
      correct: "The primary sector, sir.",
      wrong: ["The secondary sector, sir.", "The tertiary sector, sir.", "The public sector, sir."],
      explanation: "Primary. It draws directly from nature before anything is manufactured.",
    },
    {
      question: "In economics, what is opportunity cost?",
      correct: "The value of the next-best alternative given up, sir.",
      wrong: [
        "The money spent on an opportunity, sir.",
        "The profit from an investment, sir.",
        "The tax on an extra unit, sir.",
      ],
      explanation: "Exactly. Every choice has a cost beyond the money you hand over.",
    },
  ],
  bobo: [
    {
      question: "Which imaginary line divides the Earth into the Northern and Southern Hemispheres?",
      correct: "The Equator, sir.",
      wrong: ["The Prime Meridian, sir.", "The Tropic of Cancer, sir.", "The Arctic Circle, sir."],
      explanation: "The Equator. If you forget that, every map becomes guesswork.",
    },
    {
      question: "What do we call the layer of the atmosphere where weather happens?",
      correct: "The troposphere, sir.",
      wrong: ["The stratosphere, sir.", "The mesosphere, sir.", "The ionosphere, sir."],
      explanation: "Troposphere. Clouds, rain, and your excuses all live in the same layer.",
    },
  ],
  uma: [
    {
      question: "If a circle has a radius of seven centimetres, what is its circumference? Use twenty-two over seven for pi.",
      correct: "Forty-four centimetres, ma'am.",
      wrong: ["Twenty-two centimetres, ma'am.", "Thirty-eight centimetres, ma'am.", "Forty-nine centimetres, ma'am."],
      explanation: "Forty-four. The formula was not optional the first time either.",
    },
    {
      question: "What is the sum of the interior angles of a triangle?",
      correct: "One hundred and eighty degrees, ma'am.",
      wrong: ["Ninety degrees, ma'am.", "Two hundred and seventy degrees, ma'am.", "Three hundred and sixty degrees, ma'am."],
      explanation: "One hundred and eighty. Remember it before you are asked a second time.",
    },
  ],
  sarjubala: [
    {
      question: "In Manipuri classical dance, what is the gentle, rounded walk called?",
      correct: "Chali, ma'am.",
      wrong: ["Tandava, ma'am.", "Jhumur, ma'am.", "Gat, ma'am."],
      explanation: "Yes, chali. A calm walk says as much as a fast one — perhaps more.",
    },
    {
      question: "Which Manipuri dance form tells the story of Radha and Krishna?",
      correct: "Ras Leela, ma'am.",
      wrong: ["Lai Haraoba, ma'am.", "Pung Cholom, ma'am.", "Thang-Ta, ma'am."],
      explanation: "Ras Leela. There is a whole world in it, not just a performance.",
    },
  ],
  birjit: [
    {
      question: "In a library, what does the call number on a book spine help you find?",
      correct: "Its exact shelf position, sir.",
      wrong: ["Its price, sir.", "Its publisher, sir.", "Its borrowing history, sir."],
      explanation: "Its shelf position. A library without order is just a room full of paper.",
    },
    {
      question: "What should you do with a book you have finished reading in the library?",
      correct: "Return it to its proper place, sir.",
      wrong: ["Leave it on the table, sir.", "Give it to another student, sir.", "Keep it for the next period, sir."],
      explanation: "Its proper place. Someone else needs it to be there.",
    },
  ],
  lokeshori: [
    {
      question: "How many players are on a basketball court per team at one time?",
      correct: "Five, ma'am.",
      wrong: ["Six, ma'am.", "Seven, ma'am.", "Four, ma'am."],
      explanation: "Five. Now imagine running the drill and counting at the same time.",
    },
    {
      question: "Which activity best builds cardiovascular endurance?",
      correct: "Distance running, ma'am.",
      wrong: ["A static stretch, ma'am.", "A one-rep lift, ma'am.", "A balance hold, ma'am."],
      explanation: "Distance running. There is no shortcut worth pretending about.",
    },
  ],
  ene: [
    {
      question: "The mess is short of clean trays. What do you do after your meal?",
      correct: "Take my tray to the washing point, ma'am.",
      wrong: ["Leave it on the table, ma'am.", "Pass it to a friend, ma'am.", "Stack it under the bench, ma'am."],
      explanation: "Perfect. The kitchen is not a magical place where trays clean themselves.",
    },
    {
      question: "Why should you not waste food at the mess?",
      correct: "Because it is everyone's share, ma'am.",
      wrong: ["Because the plates are heavy, ma'am.", "Because it makes the table untidy, ma'am.", "Because the bell will ring, ma'am."],
      explanation: "Exactly. Take what you will eat; come back if you are still hungry.",
    },
  ],
  sanathoi: [
    {
      question: "What is the correct order at the mess counter?",
      correct: "Join the queue and wait my turn, sir.",
      wrong: ["Call the loudest, sir.", "Send a friend ahead, sir.", "Take the first plate I see, sir."],
      explanation: "A queue. Remarkably quick when everyone remembers it exists.",
    },
    {
      question: "The dal is finished and the line is long. What is the sensible answer?",
      correct: "Tell the server politely and take what is available, sir.",
      wrong: ["Argue with the server, sir.", "Skip the meal entirely, sir.", "Take someone else's plate, sir."],
      explanation: "Polite and practical. The kitchen notices manners, believe me.",
    },
  ],
  local: [
    {
      question: "Whose job is it to keep the field and gate area tidy?",
      correct: "The whole campus shares it, sir — I help.",
      wrong: ["Only the students, sir.", "Only the MTS staff, sir.", "Nobody's, sir."],
      explanation: "Shared. I sweep it; you avoid dropping it. Simple arrangement.",
    },
    {
      question: "A gate is left open after hours. What is the first thing you do?",
      correct: "Tell the staff on duty, sir.",
      wrong: ["Close it and say nothing, sir.", "Ignore it, sir.", "Wait for someone else, sir."],
      explanation: "Report it. Quiet fixes are how bigger problems begin.",
    },
  ],
};

/**
 * Local, rule-based branching dialogue. Every question knows the actual
 * student, area, timetable phase, teacher personality, warnings and prior
 * encounter history. No answer uses a hidden random punishment.
 */
export class TeacherDialogueManager {
  private nodes = new Map<string, DialogueNodeSpec>();
  private currentId: string | null = null;
  private context: TeacherDialogueContext | null = null;
  private notice: string | null = null;
  private referralText: string | null = null;
  private mood: TeacherDialogueMeta["mood"] = "calm";
  private currentQuestion = "";
  private answered = new Set<string>();
  private readonly memory: TeacherMemoryManager;
  private readonly personality: TeacherPersonalityManager;

  constructor(memory: TeacherMemoryManager, personality: TeacherPersonalityManager) {
    this.memory = memory;
    this.personality = personality;
  }

  get isActive(): boolean {
    return this.currentId !== null;
  }

  get activeTeacherId(): TeacherId | null {
    return this.context?.config.id ?? null;
  }

  start(context: TeacherDialogueContext): DialogueView {
    this.nodes.clear();
    this.answered.clear();
    this.notice = null;
    this.referralText = null;
    this.mood = context.config.personality === "strict" ? "stern" : "calm";
    this.context = context;
    const memory = this.memory.memoryFor(context.config.id);
    const name = context.identity.firstName;

    if (memory.encounters === 0) {
      this.addClassQuestion(context);
      this.currentId = "identity-class";
    } else if (context.violation && memory.warnings > 0) {
      this.addRepeatQuestion(context, memory.lastOutcome === "warning");
      this.currentId = "repeat";
    } else if (context.violation) {
      this.addDisciplineQuestion(context);
      this.currentId = "discipline";
    } else if (this.shouldAskSubject(context, memory.encounters)) {
      this.addSubjectQuestion(context);
      this.currentId = "subject";
    } else if (context.area === "hostel" || context.area === "entrance") {
      this.addDestinationQuestion(context, name);
      this.currentId = "destination";
    } else {
      this.addActivityQuestion(context, name);
      this.currentId = "activity";
    }
    return this.currentView();
  }

  choose(index: number): TeacherChoiceResult | null {
    if (!this.context || !this.currentId) return null;
    const node = this.nodes.get(this.currentId);
    const choice = node?.choices?.[index];
    if (!node || !choice) return null;
    if (this.answered.has(node.id)) return null;
    this.answered.add(node.id);

    const config = this.context.config;
    const memory = this.memory.memoryFor(config.id);
    const warningsBefore = memory.warnings;
    const incorrect = choice.correct === false || choice.tone === "excuse";
    const disrespectful = choice.tone === "disrespectful";
    const respectful = choice.tone === "respectful";
    const correct = choice.correct === true;
    const warned = this.personality.shouldWarn({
      personality: config.personality,
      disrespectful,
      incorrect,
      timetableViolation: this.context.violation,
      warnings: warningsBefore,
    });
    const delta = this.personality.reputationDelta({
      personality: config.personality,
      respectful,
      correct,
      disrespectful,
      warned,
    });
    const entry = this.memory.record({
      teacherId: config.id,
      question: node.question,
      reply: choice.label,
      outcome: warned ? "warning" : delta > 0 ? "positive" : "neutral",
      warned,
      reputationDelta: delta,
    });
    const warningsAfter = this.memory.warningsFor(config.id);
    const principalReferral = warned && (disrespectful || warningsAfter >= 2);

    let disciplineStarted = false;
    if (
      !principalReferral &&
      warned &&
      this.context.violation &&
      config.personality === "strict" &&
      warningsAfter >= 2 &&
      !this.memory.disciplineActive()
    ) {
      this.memory.startDiscipline({ teacherId: config.id });
      disciplineStarted = true;
      entry.outcome = "disciplined";
    }
    if (principalReferral) {
      // A formal referral supersedes the shorter hostel supervision task.
      this.memory.cancelDiscipline();
      this.referralText =
        "This is now a formal referral: report to the Principal's Chamber immediately. Principal Moinm Rahman is expecting you.";
    }

    this.mood = warned ? "stern" : delta >= 4 ? "encouraging" : config.personality === "funny" ? "amused" : "calm";
    this.notice = principalReferral
      ? "Principal referral issued · report to the Principal's Chamber"
      : disciplineStarted
        ? "Discipline task assigned · report to your house hostel"
        : warned
          ? `Warning ${warningsAfter} recorded · conduct ${this.memory.reputation}/100`
          : `${delta >= 0 ? "+" : ""}${delta} conduct · ${this.memory.reputationLabel()}`;

    this.currentId = choice.next;
    const nextNode = this.nodes.get(choice.next);
    if (nextNode && choice.notice) this.notice = choice.notice;
    return {
      view: this.currentView(),
      ended: !nextNode,
      warning: warned,
      disciplineStarted,
      reputationDelta: delta,
      notice: this.notice,
      answer: choice.label,
      principalReferral,
      referralReason: principalReferral
        ? disrespectful
          ? `Disrespectful reply during ${this.context.time.label.toLowerCase()} at ${areaLabel(this.context.area)}`
          : `${warningsAfter} warnings recorded during ${this.context.time.label.toLowerCase()}`
        : null,
    };
  }

  advance(): boolean {
    if (!this.currentId) return true;
    const node = this.nodes.get(this.currentId);
    if (!node) return true;
    if (node.choices && node.choices.length > 0) return false;
    if (node.next) {
      this.currentId = node.next;
      return false;
    }
    this.currentId = null;
    return true;
  }

  end(): void {
    this.currentId = null;
    this.context = null;
    this.nodes.clear();
    this.answered.clear();
    this.notice = null;
    this.referralText = null;
  }

  currentView(): DialogueView {
    const context = this.context;
    const node = this.currentId ? this.nodes.get(this.currentId) : null;
    if (!context || !node) {
      return {
        speaker: context?.config.name ?? "Teacher",
        role: context?.config.subject ?? "Staff",
        text: "",
        choices: [],
        canAdvance: false,
      };
    }
    return {
      speaker: context.config.name,
      role: `${context.config.subject} · Faculty`,
      text: `${node.text}${this.referralText ? ` ${this.referralText}` : ""}`,
      choices: (node.choices ?? []).map((choice) => ({ label: choice.label, next: choice.next })),
      canAdvance: !node.choices || node.choices.length === 0,
      teacher: this.meta(),
    };
  }

  private meta(): TeacherDialogueMeta {
    const context = this.context;
    if (!context) {
      return {
        teacherId: "dinesh",
        name: "Teacher",
        subject: "Faculty",
        gender: "unspecified",
        personality: "neutral",
        personalityLabel: "Faculty",
        period: "",
        location: "",
        warningCount: 0,
        reputation: 0,
        mood: "calm",
        portrait: {
          skin: "#a8734c",
          hair: "#171412",
          shirt: "#d9d4c7",
          accents: "#9f7d4a",
          glasses: false,
          beard: false,
          moustache: false,
        },
        notice: null,
      };
    }
    const { config, identity } = context;
    return {
      teacherId: config.id,
      name: config.name,
      subject: config.subject,
      gender: config.gender,
      personality: config.personality,
      personalityLabel: this.personality.profile(config.personality).label,
      period: `${context.time.label} · ${context.time.clock}`,
      location: areaLabel(context.area),
      warningCount: this.memory.warningsFor(config.id),
      reputation: this.memory.reputation,
      mood: this.mood,
      portrait: {
        skin: config.appearance.skin,
        hair: config.appearance.hair,
        shirt: config.appearance.shirt,
        accents: config.appearance.accents,
        glasses: config.appearance.glasses,
        beard: config.appearance.beard,
        moustache: config.appearance.moustache,
      },
      notice: this.notice ?? (this.memory.encountersFor(config.id) > 1 && identity ? "Recognised" : null),
    };
  }

  private shouldAskSubject(context: TeacherDialogueContext, encounters: number): boolean {
    if (context.violation) return false;
    if (context.area === "playground" && context.config.id === "dinesh") return true;
    return encounters > 0 && encounters % 2 === 0;
  }

  private addClassQuestion(context: TeacherDialogueContext): void {
    const name = context.identity.firstName;
    this.add({
      id: "identity-class",
      question: "Which class are you in?",
      text: `${name}! You are on my round. Which class are you in?`,
      choices: [
        {
          label: `Class ${context.identity.className}, sir.`,
          next: "identity-class-good",
          tone: "respectful",
          correct: true,
        },
        {
          label: "Class 9, sir.",
          next: "identity-class-wrong",
          tone: "honest",
          correct: false,
        },
        {
          label: "Why do you need to know, sir?",
          next: "identity-class-disrespect",
          tone: "disrespectful",
        },
      ],
    });
    this.add({
      id: "identity-class-good",
      question: "Which class are you in?",
      text:
        context.config.personality === "strict"
          ? `Class ${context.identity.className}. Good. At least one of us knows which class he belongs to.`
          : context.config.personality === "serious"
            ? `Class ${context.identity.className}, recorded. Accuracy in small things matters. Which house do you belong to?`
            : `Class ${context.identity.className} — thank you. Now, which house do you belong to?`,
      next: "identity-house",
    });
    this.add({
      id: "identity-class-wrong",
      question: "Which class are you in?",
      text: `Your record says Class ${context.identity.className}, ${name}. I expect the right answer next time. Which house are you in?`,
      next: "identity-house",
    });
    this.add({
      id: "identity-class-disrespect",
      question: "Which class are you in?",
      text: "I am your teacher, and that is the answer to your question. We will try again when you can speak properly.",
    });

    this.add({
      id: "identity-house",
      question: "Which house do you belong to?",
      text: `Which house do you belong to?`,
      choices: [
        {
          label: `${context.identity.houseName}, sir.`,
          next: "identity-house-good",
          tone: "respectful",
          correct: true,
        },
        {
          label: "Nilgiri House, sir.",
          next: "identity-house-wrong",
          tone: "honest",
          correct: false,
        },
        {
          label: "I don't remember, sir.",
          next: "identity-house-wrong",
          tone: "excuse",
        },
        {
          label: "Why does the house matter, sir?",
          next: "identity-house-disrespect",
          tone: "disrespectful",
        },
      ],
    });
    this.add({
      id: "identity-house-good",
      question: "Which house do you belong to?",
      text: `${context.identity.houseName}. Correct, ${name}. And your roll number?`,
      next: "identity-roll",
    });
    this.add({
      id: "identity-house-wrong",
      question: "Which house do you belong to?",
      text: `Your house is ${context.identity.houseName}. I do not like guessing games about identity. Roll number?`,
      next: "identity-roll",
    });
    this.add({
      id: "identity-house-disrespect",
      question: "Which house do you belong to?",
      text: "It matters because your house is responsible for you. Report to your house tutor and reflect on that answer.",
    });

    const roll = context.identity.rollNumber;
    this.add({
      id: "identity-roll",
      question: "What is your roll number?",
      text: "What is your roll number?",
      choices: [
        {
          label: roll ? `Roll ${roll}, sir.` : "My roster has no roll number, sir.",
          next: "identity-roll-good",
          tone: "respectful",
          correct: true,
        },
        {
          label: roll ? `Roll ${roll + 9}, sir.` : "Roll 34, sir.",
          next: "identity-roll-wrong",
          tone: "honest",
          correct: false,
        },
        {
          label: "Why are you testing me, sir?",
          next: "identity-roll-disrespect",
          tone: "disrespectful",
        },
      ],
    });
    this.add({
      id: "identity-roll-good",
      question: "What is your roll number?",
      text:
        context.config.personality === "strict"
          ? `Roll ${roll}. Then I will remember your face and your number, ${name}. ${context.violation ? this.violationQuestion(context) : "Do not give me a reason to use both."}`
          : `Roll ${roll} — noted. ${context.violation ? this.violationQuestion(context) : "Have a good day, and keep to the timetable."}`,
      ...(context.violation ? { next: "discipline" } : {}),
    });
    this.add({
      id: "identity-roll-wrong",
      question: "What is your roll number?",
      text: `Your roll number is ${roll ?? "not listed"}. I have it in front of me. ${context.violation ? this.violationQuestion(context) : "Do not test me on your own identity again."}`,
      ...(context.violation ? { next: "discipline" } : {}),
    });
    this.add({
      id: "identity-roll-disrespect",
      question: "What is your roll number?",
      text: "Because a name and a number are how we look after four hundred students. Go back to your proper place and think about your tone.",
    });
    if (context.violation) this.addDisciplineQuestion(context);
  }

  private addRepeatQuestion(context: TeacherDialogueContext, wasWarned: boolean): void {
    const name = context.identity.firstName;
    const warning = context.warningsBefore;
    this.add({
      id: "repeat",
      question: "Why are you here again?",
      text: wasWarned
        ? `${name}! Again? Did I not tell you to ${this.expectedAction(context)}? This is warning number ${warning + 1} if your answer does not make sense.`
        : `${name}, you were warned earlier about ${areaLabel(context.area)}. ${this.violationQuestion(context)}`,
      choices: [
        {
          label: "You did, sir. I'm correcting it now — I'm going back.",
          next: "repeat-correct",
          tone: "respectful",
          correct: true,
        },
        {
          label: "I had a genuine reason, sir. I'm on my way back now.",
          next: "repeat-reason",
          tone: "honest",
        },
        {
          label: "I was only here for a minute, sir.",
          next: "repeat-excuse",
          tone: "excuse",
        },
        {
          label: "You keep finding me, sir. That is not my fault.",
          next: "repeat-disrespect",
          tone: "disrespectful",
        },
      ],
    });
    this.add({
      id: "repeat-correct",
      question: "Why are you here again?",
      text: `Good. Then move. I will remember that you corrected it, ${name}.`,
    });
    this.add({
      id: "repeat-reason",
      question: "Why are you here again?",
      text: context.config.personality === "strict"
        ? `A reason is not a pass. ${this.expectedActionSentence(context)}.`
        : `All right. I understand things happen; make sure you are where you should be next time.`,
    });
    this.add({
      id: "repeat-excuse",
      question: "Why are you here again?",
      text:
        context.config.personality === "strict"
          ? "A minute is enough time to be somewhere you should not. We have already had this conversation. Do not make it three warnings."
          : "One minute still belongs to the school timetable. Let us not make this a habit.",
    });
    this.add({
      id: "repeat-disrespect",
      question: "Why are you here again?",
      text: "That attitude is precisely the problem. Report to the Principal's Chamber immediately. Principal Moinm Rahman will hear the full account.",
    });
  }

  private addDisciplineQuestion(context: TeacherDialogueContext): void {
    const name = context.identity.firstName;
    this.add({
      id: "discipline",
      question: "Why are you here instead of where you should be?",
      text: `${name}, stop. ${this.violationQuestion(context)}`,
      choices: [
        {
          label: "No excuse, sir. I'll go where I should be right now.",
          next: "discipline-correct",
          tone: "respectful",
          correct: true,
        },
        {
          label: "I have a note from my teacher, sir.",
          next: "discipline-note",
          tone: "honest",
          correct: false,
          notice: "No forged permission was accepted — the answer is checked against the timetable.",
        },
        {
          label: "I was only taking a shortcut, sir.",
          next: "discipline-excuse",
          tone: "excuse",
        },
        {
          label: "The timetable is boring, sir.",
          next: "discipline-disrespect",
          tone: "disrespectful",
        },
      ],
    });
    this.add({
      id: "discipline-correct",
      question: "Why are you here instead of where you should be?",
      text:
        context.config.personality === "strict"
          ? `Exactly. ${this.expectedActionSentence(context)}. I will be watching the path, not the excuse.`
          : `Thank you for being straight with me. Go on — ${this.expectedAction(context)}.`,
    });
    this.add({
      id: "discipline-note",
      question: "Why are you here instead of where you should be?",
      text:
        "A note is checked with the teacher who signed it, not produced on the spot. Since we have no written pass in front of me, go back to the proper place and bring it next time.",
    });
    this.add({
      id: "discipline-excuse",
      question: "Why are you here instead of where you should be?",
      text:
        context.config.personality === "strict"
          ? `A shortcut that takes you away from ${this.expectedArea(context)} is not a shortcut. ${this.expectedActionSentence(context)}.`
          : `I would rather you took the honest path than the short one. ${this.expectedActionSentence(context)}.`,
    });
    this.add({
      id: "discipline-disrespect",
      question: "Why are you here instead of where you should be?",
      text:
        context.config.id === "dinesh"
          ? "The timetable is not here to entertain you. It is here so four hundred students can live together. Report to the Principal's Chamber immediately."
          : "You may find the timetable dull; that does not give you permission to ignore it. Go back to your proper place and we will speak again.",
    });
  }

  private addDestinationQuestion(context: TeacherDialogueContext, name: string): void {
    this.add({
      id: "destination",
      question: "Where are you going?",
      text:
        context.config.personality === "strict"
          ? `${name}. Where are you going?`
          : `${name}, where are you headed?`,
      choices: [
        {
          label: `I'm going to ${areaLabel(context.area)}, sir.`,
          next: "destination-area",
          tone: "respectful",
          correct: true,
        },
        {
          label: "I'm returning to my house hostel, sir.",
          next: "destination-hostel",
          tone: "respectful",
        },
        {
          label: "I'm waiting for a friend, sir.",
          next: "destination-friend",
          tone: "honest",
        },
        {
          label: "Just walking around, sir.",
          next: "destination-walking",
          tone: "honest",
        },
      ],
    });
    this.add({
      id: "destination-area",
      question: "Where are you going?",
      text: `${areaLabel(context.config.patrolAreas[0])} is your area, but I did not ask you to repeat the map. ${this.timeAwareSentence(context)}`,
    });
    this.add({
      id: "destination-hostel",
      question: "Where are you going?",
      text:
        context.time.phase === "class" || context.time.phase === "prep" || context.time.phase === "games"
          ? `The hostel can wait. ${this.expectedActionSentence(context)}.`
          : `Your house hostel? Then take the path and sign in at the door.`,
    });
    this.add({
      id: "destination-friend",
      question: "Where are you going?",
      text:
        context.config.personality === "friendly"
          ? "All right. Keep it brief, and don't let the bell find you on the lawn."
          : context.config.personality === "serious"
            ? "A friend is not a scheduled destination. Decide what you are actually doing, then be where you should be before the bell."
            : "A friend is not a destination on the timetable. Make sure you are back where you belong before the next bell.",
    });
    this.add({
      id: "destination-walking",
      question: "Where are you going?",
      text: `${name}, 'walking around' is not a place. ${this.timeAwareSentence(context)}`,
    });
  }

  private addActivityQuestion(context: TeacherDialogueContext, name: string): void {
    this.add({
      id: "activity",
      question: "What are you doing here?",
      text:
        context.config.personality === "funny"
          ? `${name}, what are you doing here? And please, make the answer more interesting than 'nothing, sir'.`
          : `${name}, what are you doing here?`,
      choices: [
        {
          label: `I'm taking a short break here before ${this.nextExpectedActivity(context)}.`,
          next: "activity-break",
          tone: "respectful",
          correct: true,
        },
        {
          label: "I'm on my way to class, sir.",
          next: "activity-class",
          tone: "respectful",
          correct: context.area === "academic",
        },
        {
          label: "Just passing time, sir.",
          next: "activity-passing",
          tone: "excuse",
        },
        {
          label: "Nothing much, sir.",
          next: "activity-nothing",
          tone: "honest",
        },
      ],
    });
    this.add({
      id: "activity-break",
      question: "What are you doing here?",
      text: `${this.timeAwareSentence(context)} A short break is fine for now.`,
    });
    this.add({
      id: "activity-class",
      question: "What are you doing here?",
      text:
        context.area === "academic"
          ? "Then you are already close. Take the corridor and get in before you are late."
          : `Class is not held at ${areaLabel(context.area)}. I would rather hear the truth than watch you improvise a route.`,
    });
    this.add({
      id: "activity-passing",
      question: "What are you doing here?",
      text:
        context.config.personality === "funny"
          ? "Passing time on a campus that has an actual timetable. Brave."
          : context.config.personality === "serious"
            ? "Unstructured time is still school time. Give me a purpose and a destination, not a shrug."
            : "Time is not something to pass in the middle of a school day. Find your proper activity.",
    });
    this.add({
      id: "activity-nothing",
      question: "What are you doing here?",
      text: `Then let us find you something useful. ${this.expectedActionSentence(context)}.`,
    });
  }

  private addSubjectQuestion(context: TeacherDialogueContext): void {
    const bank = SUBJECT_QUESTIONS[context.config.id] ?? SUBJECT_QUESTIONS.sushil;
    const rawIndex = context.warningsBefore + context.time.minuteOfDay + context.area.length;
    const index = Number.isFinite(rawIndex)
      ? Math.abs(Math.floor(rawIndex)) % bank.length
      : 0;
    const question = bank[index] ?? bank[0];
    const options = [question.correct, ...question.wrong];
    // Deterministic shuffle so the correct answer is not always first.
    const rotated = [...options.slice(index % options.length), ...options.slice(0, index % options.length)];
    this.add({
      id: "subject",
      question: question.question,
      text: `${context.identity.firstName}, since you are here — ${question.question}`,
      choices: rotated.map((label) => ({
        label,
        next: label === question.correct ? "subject-correct" : "subject-incorrect",
        tone: "respectful" as const,
        correct: label === question.correct,
      })),
    });
    this.add({
      id: "subject-correct",
      question: question.question,
      text: `${question.explanation} Good. At least the lesson stayed with you.`,
    });
    this.add({
      id: "subject-incorrect",
      question: question.question,
      text: `${question.explanation} Think about it before tomorrow; I may ask again.`,
    });
  }

  private violationQuestion(context: TeacherDialogueContext): string {
    const phase = context.time.phase;
    if (phase === "class") {
      return `It is ${context.time.clock}, during ${context.time.label.toLowerCase()}. Why are you at ${areaLabel(context.area)} instead of the academic block?`;
    }
    if (phase === "games") {
      return `It is games period. Why are you at ${areaLabel(context.area)} instead of the playground?`;
    }
    if (phase === "prep") {
      return `It is evening prep. What are you doing at ${areaLabel(context.area)}?`;
    }
    if (phase === "hostel") {
      return `It is after lights-out. Why are you outside the house hostel?`;
    }
    return `It is ${context.time.label.toLowerCase()}, and ${areaLabel(context.area)} is not where I expected to find you. What is your explanation?`;
  }

  private expectationSentence(context: TeacherDialogueContext): string {
    return context.time.period.expectation;
  }

  private expectedArea(context: TeacherDialogueContext): string {
    switch (context.time.phase) {
      case "class":
        return "the academic block";
      case "games":
        return "the playground";
      case "prep":
        return "prep";
      case "hostel":
        return "the house hostel";
      case "lunch":
      case "dinner":
        return "the dining hall";
      case "assembly":
        return "assembly";
      default:
        return "your assigned area";
    }
  }

  private expectedAction(context: TeacherDialogueContext): string {
    return `go to ${this.expectedArea(context)} now`;
  }

  private expectedActionSentence(context: TeacherDialogueContext): string {
    const action = this.expectedAction(context);
    return `${action.charAt(0).toUpperCase()}${action.slice(1)}`;
  }

  private nextExpectedActivity(context: TeacherDialogueContext): string {
    switch (context.time.phase) {
      case "games":
        return "games";
      case "class":
        return "class";
      case "prep":
        return "prep";
      default:
        return "the next bell";
    }
  }

  private timeAwareSentence(context: TeacherDialogueContext): string {
    if (context.violation) {
      return `But it is ${context.time.label.toLowerCase()} — ${context.time.period.expectation}`;
    }
    return `It is ${context.time.label.toLowerCase()}, and ${context.time.period.expectation}`;
  }

  private add(node: DialogueNodeSpec): void {
    if (this.nodes.has(node.id)) return;
    this.nodes.set(node.id, node);
  }
}
