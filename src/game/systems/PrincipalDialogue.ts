import type { DialogueNode, DialogueView } from "../core/types";
import { PRINCIPAL } from "../data/principal";
import { MESS_MEAL_PRINCIPAL_OPENING } from "../data/messMeal";

export interface PrincipalDialogueContext {
  studentName: string;
  referralActive: boolean;
  teacherName: string | null;
  reason: string | null;
  /** CLASS BUNK caught flow offers a resume or end decision. */
  bunkActive?: boolean;
  /** MESS MEAL SNEAK caught flow has its own authored conversation. */
  messMealActive?: boolean;
  mealCollected?: boolean;
}

/**
 * The Principal's authored conversation. A referral requires the student to
 * reach the acknowledgement node; closing before that leaves the mission open.
 */
export class PrincipalDialogue {
  private nodes = new Map<string, DialogueNode>();
  private currentId: string | null = null;
  private resolved = false;
  private bunkOutcome: "resume" | "end" | null = null;
  private messOutcome: "resume" | "return" | null = null;

  get isActive(): boolean {
    return this.currentId !== null;
  }

  get isResolved(): boolean {
    return this.resolved;
  }

  get classBunkOutcome(): "resume" | "end" | null {
    return this.bunkOutcome;
  }

  get messMealOutcome(): "resume" | "return" | null {
    return this.messOutcome;
  }

  start(context: PrincipalDialogueContext): DialogueView {
    this.nodes.clear();
    this.resolved = false;
    this.bunkOutcome = null;
    this.messOutcome = null;
    const teacher = context.teacherName ?? "your teacher";
    if (context.messMealActive && context.referralActive) {
      this.add({
        id: "mess-intro",
        text: MESS_MEAL_PRINCIPAL_OPENING,
        choices: [
          {
            label: "I was trying to bring food for my roommates.",
            next: "mess-food",
          },
          {
            label: "I am sorry, Sir.",
            next: "mess-sorry",
          },
          {
            label: "I did not think it would cause a problem.",
            next: "mess-thoughtless",
          },
        ],
      });
      this.add({
        id: "mess-food",
        text: `Food for your roommates is a generous thought, but generosity does not cancel a rule. ${teacher} caught you outside your hostel after lights-out. You should have asked the warden or waited until morning.`,
        next: "mess-decision",
      });
      this.add({
        id: "mess-sorry",
        text: `An apology is a beginning, not a pass. ${teacher} has reported the incident, and I have to consider both your safety and the example it sets for the hostel.`,
        next: "mess-decision",
      });
      this.add({
        id: "mess-thoughtless",
        text: `Not thinking is exactly how a quiet campus becomes a dangerous one. ${teacher} had to leave a real patrol to stop you. A rule you did not notice is still a rule.`,
        next: "mess-decision",
      });
      this.add({
        id: "mess-decision",
        text: context.mealCollected
          ? "The referral will be recorded. You still have the food with you. Do you want to carry it back to your hostel and finish this properly, or leave it and return now?"
          : "The referral will be recorded. You have not collected anything yet. Do you want to try again and finish what you set out to do, or return to your hostel?",
        choices: [
          {
            label: "I want to finish bringing the food to my roommates.",
            next: "mess-resume",
          },
          {
            label: "I will return to the hostel, sir.",
            next: "mess-return",
          },
        ],
      });
      this.add({
        id: "mess-resume",
        text: "Go carefully, stay on the lit paths, and report to your warden tomorrow. If anyone else stops you, tell them I have already dealt with it.",
      });
      this.add({
        id: "mess-return",
        text: "Straight back to your hostel. We will speak again about the rule you broke, not about the food you wanted to share.",
      });
      this.currentId = "mess-intro";
      return this.currentView();
    }
    if (!context.referralActive) {
      this.add({
        id: "general",
        text: `I am ${PRINCIPAL.name}, the Principal. The office is open to every student, but a visit here should have a purpose. Return to your timetable, and keep your teachers informed when something is wrong.`,
      });
      this.currentId = "general";
      return this.currentView();
    }

    this.add({
      id: "intro",
      text: `${context.studentName}, your teacher ${teacher} has reported your behaviour. I am ${PRINCIPAL.name}, the Principal. Do you understand why discipline and respect are important?`,
      choices: [
        {
          label: "Yes, sir. I understand, and I will correct my behaviour.",
          next: "accept",
        },
        {
          label: "I understand now. I should have followed my teacher's instruction.",
          next: "accept",
        },
        {
          label: "I think my teacher was too harsh, sir.",
          next: "defend",
        },
      ],
    });
    this.add({
      id: "accept",
      text: `Good. ${context.reason ? `The report says: ${context.reason}.` : "A teacher's instruction is part of the school routine."} Understanding the rule is the first step; following it when nobody is watching is the real test.`,
      next: "commit",
    });
    this.add({
      id: "defend",
      text: `Being unhappy with a decision is not the same as being free to ignore it. Your teacher is responsible for your safety and for the class around you. If you disagree, you bring the matter here calmly, not by disrupting a teacher's work.`,
      next: "commit",
    });
    if (context.bunkActive) {
      this.add({
        id: "commit",
        text: "Then we understand each other. You have already missed part of your class. Do you want to return to your classroom and finish what you started, or end this foolishness here and now?",
        choices: [
          {
            label: "I will return to class and finish the day properly, sir.",
            next: "resume-bunk",
          },
          {
            label: "I understand, sir. I will end it here.",
            next: "end-bunk",
          },
        ],
      });
      this.add({
        id: "resume-bunk",
        text: "Go. Straight back to Room 101, and no more detours. I will be watching the corridors.",
      });
      this.add({
        id: "end-bunk",
        text: "A sensible choice. Return to your class now. The attempt ends here, but the lesson stays on record.",
      });
    } else {
      this.add({
        id: "commit",
        text: "Then we understand each other. Return to your class or hostel, follow the next instruction you are given, and let your conduct improve from today. This conversation will be recorded.",
        choices: [
          {
            label: "Yes, sir. Thank you for hearing me.",
            next: "close",
          },
          {
            label: "I will do better, sir.",
            next: "close",
          },
        ],
      });
      this.add({
        id: "close",
        text: "You may go. Remember that respect is shown in what you do after you leave this room.",
      });
    }
    this.currentId = "intro";
    return this.currentView();
  }

  currentView(): DialogueView {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node) {
      return {
        speaker: PRINCIPAL.name,
        role: PRINCIPAL.role,
        text: "You may return to your duties.",
        choices: [],
        canAdvance: true,
      };
    }
    return {
      speaker: PRINCIPAL.name,
      role: PRINCIPAL.role,
      text: node.text,
      choices: node.choices ?? [],
      canAdvance: !node.choices || node.choices.length === 0,
    };
  }

  choose(index: number): boolean {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    const choice = node?.choices?.[index];
    if (!node || !choice || !this.nodes.has(choice.next)) return false;
    // Choosing at the commitment step is the required resolution; closing at
    // the introduction or before acknowledging leaves the referral open.
    if (this.currentId === "commit") {
      this.resolved = true;
      if (choice.next === "resume-bunk") this.bunkOutcome = "resume";
      if (choice.next === "end-bunk") this.bunkOutcome = "end";
    }
    if (this.currentId === "mess-decision") {
      this.resolved = true;
      if (choice.next === "mess-resume") this.messOutcome = "resume";
      if (choice.next === "mess-return") this.messOutcome = "return";
    }
    this.currentId = choice.next;
    return true;
  }

  advance(): boolean {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node) {
      this.currentId = null;
      return true;
    }
    if (node.choices && node.choices.length > 0) return false;
    if (node.next && this.nodes.has(node.next)) {
      this.currentId = node.next;
      return false;
    }
    this.currentId = null;
    return true;
  }

  end(): void {
    this.currentId = null;
    this.nodes.clear();
  }

  private add(node: DialogueNode): void {
    this.nodes.set(node.id, node);
  }
}
