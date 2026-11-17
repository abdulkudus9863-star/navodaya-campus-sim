import type { DialogueNode, DialogueView } from "../core/types";
import { PRINCIPAL } from "../data/principal";

export interface PrincipalDialogueContext {
  studentName: string;
  referralActive: boolean;
  teacherName: string | null;
  reason: string | null;
}

/**
 * The Principal's authored conversation. A referral requires the student to
 * reach the acknowledgement node; closing before that leaves the mission open.
 */
export class PrincipalDialogue {
  private nodes = new Map<string, DialogueNode>();
  private currentId: string | null = null;
  private resolved = false;

  get isActive(): boolean {
    return this.currentId !== null;
  }

  get isResolved(): boolean {
    return this.resolved;
  }

  start(context: PrincipalDialogueContext): DialogueView {
    this.nodes.clear();
    this.resolved = false;
    const teacher = context.teacherName ?? "your teacher";
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
    if (this.currentId === "commit") this.resolved = true;
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
