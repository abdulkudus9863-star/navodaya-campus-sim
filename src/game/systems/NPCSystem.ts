import type { DialogueNode, DialogueView } from "../core/types";

const SPEAKER = "Meera";
const ROLE = "Senior · Nilgiri House";

export interface DialogueContext {
  step: number;
  done: boolean;
}

/**
 * One authored NPC with a small branching conversation. The tree is rebuilt
 * from mission progress so Meera always says something useful.
 */
export class NPCSystem {
  private nodes = new Map<string, DialogueNode>();
  private currentId: string | null = null;

  get isActive(): boolean {
    return this.currentId !== null;
  }

  start(context: DialogueContext): DialogueView {
    this.nodes.clear();
    if (context.done) {
      this.add({
        id: "after",
        text: "Look at you — gate, board, classroom, hostel. One afternoon and you already walk like you belong here.",
        next: "after-2",
      });
      this.add({
        id: "after-2",
        text: "Assembly is at 6:20. Bring your house colours, and don't let the dining hall bell catch you on the wrong side of the ground.",
      });
      this.currentId = "after";
    } else if (context.step <= 0) {
      this.add({
        id: "intro-1",
        text: "You must be the new one. Class Seven, right? I'm Meera — third year, and unofficial keeper of this gate.",
        next: "intro-2",
      });
      this.add({
        id: "intro-2",
        text: "Navodaya isn't only a school. Classrooms, hostel, dining hall, library — all of it sits inside these walls. You'll know every path by Sunday.",
        choices: [
          { label: "What is this place?", next: "about" },
          { label: "Where do I start?", next: "task" },
        ],
      });
      this.add({
        id: "about",
        text: "A residential campus. Assembly at 6:20, classes till afternoon, games before dark. Meals are at the dining hall, and the library stays open late if you're the studying sort.",
        next: "task",
      });
      this.add({
        id: "task",
        text: "First, read the notice board beside the assembly ground. Then step into your classroom in the academic block. Finally, report to your hostel room. I'll be right here if you get lost.",
      });
      this.currentId = "intro-1";
    } else if (context.step === 1) {
      this.add({
        id: "reminder",
        text: "The notice board is east of the assembly ground — big green board under a small roof. You can't miss it. Find your name and your room number.",
      });
      this.currentId = "reminder";
    } else if (context.step === 2) {
      this.add({
        id: "reminder",
        text: "Academic block is on the west side. Room 12 — the classroom at the end of the veranda, beside the columns. The door sticks a little, push it.",
      });
      this.currentId = "reminder";
    } else {
      this.add({
        id: "reminder",
        text: "Your house hostel is on the south lawn — Aravali, Nilgiri, Shivalik or Udaygiri. Look for your colours over the door, then unpack. You've nearly finished your first day.",
      });
      this.currentId = "reminder";
    }
    return this.currentView();
  }

  private add(node: DialogueNode): void {
    this.nodes.set(node.id, node);
  }

  currentView(): DialogueView {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node) {
      return {
        speaker: SPEAKER,
        role: ROLE,
        text: "I'll see you at assembly.",
        choices: [],
        canAdvance: true,
      };
    }
    return {
      speaker: SPEAKER,
      role: ROLE,
      text: node.text,
      choices: node.choices ?? [],
      canAdvance: !node.choices || node.choices.length === 0,
    };
  }

  /** Returns true when the conversation has ended. */
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

  choose(index: number): boolean {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node || !node.choices) return false;
    const choice = node.choices[index];
    if (!choice || !this.nodes.has(choice.next)) return false;
    this.currentId = choice.next;
    return true;
  }

  end(): void {
    this.currentId = null;
  }
}
