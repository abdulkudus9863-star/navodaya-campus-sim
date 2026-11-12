import { getHouse, type HouseId } from "../data/houses";
import {
  GARDEN_ITEM_IDS,
  NIGHT_MISSION_TITLE,
  NIGHT_STEPS,
  NIGHT_TOTAL_STEPS,
  type GardenItemId,
} from "../data/night";
import type { DialogueNode, DialogueView, NightSave, NightView } from "../core/types";

export type NightDialogueMode = "challenge" | "caught" | null;

export class NightMissionSystem {
  active = false;
  started = false;
  caught = false;
  success = false;
  completedAt: number | null = null;
  attempts = 0;
  stepIndex = 0;
  collected: GardenItemId[] = [];

  private nodes = new Map<string, DialogueNode>();
  private currentId: string | null = null;
  private mode: NightDialogueMode = null;
  private speaker = "";
  private role = "";

  startNew(previous?: NightSave): NightView {
    this.active = true;
    this.started = true;
    this.caught = false;
    this.stepIndex = 0;
    this.collected = [];
    this.attempts = (previous?.attempts ?? 0) + 1;
    this.success = previous?.success ?? false;
    this.completedAt = previous?.completedAt ?? null;
    this.endDialogue();
    return this.view();
  }

  restore(save: NightSave): NightView {
    this.active = save.active;
    this.started = save.started;
    this.caught = save.caught;
    this.success = save.success;
    this.completedAt = save.completedAt;
    this.attempts = save.attempts;
    this.stepIndex = save.success
      ? NIGHT_TOTAL_STEPS
      : Math.min(NIGHT_TOTAL_STEPS - 1, Math.max(0, save.step));
    this.collected = [...save.collected];
    this.endDialogue();
    return this.view();
  }

  get currentStepId(): string | null {
    return NIGHT_STEPS[this.stepIndex]?.id ?? null;
  }

  get dialogueMode(): NightDialogueMode {
    return this.mode;
  }

  get isDialogueActive(): boolean {
    return this.currentId !== null;
  }

  view(suspicion = 0, hidden = false): NightView {
    const step = NIGHT_STEPS[Math.min(this.stepIndex, NIGHT_TOTAL_STEPS - 1)];
    const baseObjective = step.objective;
    const objective =
      step.id === "collect-vegetables"
        ? `${baseObjective} · ${this.collected.length}/${GARDEN_ITEM_IDS.length}`
        : baseObjective;
    return {
      active: this.active,
      step: this.stepIndex,
      total: NIGHT_TOTAL_STEPS,
      title: NIGHT_MISSION_TITLE,
      objective,
      hint: step.hint,
      collected: [...this.collected],
      suspicion: Math.max(0, Math.min(1, suspicion)),
      hidden,
      caught: this.caught,
      attempts: this.attempts,
      completedOnce: this.success,
    };
  }

  completeStep(stepId: string): boolean {
    if (!this.active) return false;
    if (this.currentStepId !== stepId) return false;
    this.stepIndex = Math.min(NIGHT_TOTAL_STEPS, this.stepIndex + 1);
    return true;
  }

  meetRoommate(): boolean {
    if (!this.active) return false;
    if (this.currentStepId === "meet-roommate") this.stepIndex += 1;
    if (this.currentStepId === "garden-challenge") this.stepIndex += 1;
    return this.currentStepId === "reach-garden";
  }

  reachGarden(): boolean {
    return this.completeStep("reach-garden");
  }

  collect(itemId: GardenItemId): { ok: boolean; completed: boolean; reason?: string } {
    if (!this.active) return { ok: false, completed: false, reason: "The night run is not active." };
    if (this.currentStepId !== "collect-vegetables") {
      return { ok: false, completed: false, reason: "You are not harvesting yet." };
    }
    if (this.collected.includes(itemId)) {
      return { ok: false, completed: false, reason: "That vegetable is already in your bag." };
    }
    if (!GARDEN_ITEM_IDS.includes(itemId)) {
      return { ok: false, completed: false, reason: "Unknown garden item." };
    }
    this.collected.push(itemId);
    const completed = this.collected.length >= GARDEN_ITEM_IDS.length;
    if (completed) this.completeStep("collect-vegetables");
    return { ok: true, completed };
  }

  returnHome(): boolean {
    if (!this.active) return false;
    if (this.currentStepId !== "return-home") return false;
    this.active = false;
    this.success = true;
    this.stepIndex = NIGHT_TOTAL_STEPS;
    this.completedAt = Date.now();
    return true;
  }

  fail(): void {
    if (!this.active) return;
    this.active = false;
    this.caught = true;
    this.collected = [];
  }

  toSave(): NightSave {
    return {
      active: this.active,
      started: this.started,
      step: this.stepIndex,
      collected: [...this.collected],
      attempts: this.attempts,
      caught: this.caught,
      success: this.success,
      completedAt: this.completedAt,
    };
  }

  // ------------------------------------------------------------ dialogue

  startChallenge(houseId: HouseId): DialogueView {
    const house = getHouse(houseId);
    this.nodes.clear();
    this.speaker = "Your roommate";
    this.role = house ? `Class VII · ${house.name}` : "Class VII";
    this.add({
      id: "wake",
      text: "Lights out was ten minutes ago. You're late — and keep your voice down, the corridor prefect is still doing rounds.",
      next: "plan",
    });
    this.add({
      id: "plan",
      text: "The teachers' kitchen garden behind the south lawn. Tomatoes, potatoes, carrots, cabbage. Four, no more. The mess pantry is empty and the inspection is at dawn.",
      choices: [
        { label: "Why not just ask the teachers?", next: "why" },
        { label: "Four vegetables. I'll go.", next: "go" },
      ],
    });
    this.add({
      id: "why",
      text: "Because the garden is 'strictly for practical botany'. We are not botany. Also, Mr. Barua counts the tomatoes. Allegedly.",
      next: "go",
    });
    this.add({
      id: "go",
      text: "Take the south path. Crouch near the hedge when the torch sweeps. If you're caught, I was asleep and you were never here.",
    });
    this.currentId = "wake";
    this.mode = "challenge";
    return this.currentView();
  }

  startCaught(): DialogueView {
    this.nodes.clear();
    this.speaker = "Mr. Barua";
    this.role = "Botany teacher · Night duty";
    this.add({
      id: "caught-1",
      text: "Stop right there. Those vegetables are for the school mess, not a midnight buffet. The tomatoes were labelled — in permanent marker.",
      next: "caught-2",
    });
    this.add({
      id: "caught-2",
      text: "The garden is for practical botany, not practical hunger. Put them back, report to your hostel, and tell your roommate the pantry has a list. A list with names on it.",
    });
    this.currentId = "caught-1";
    this.mode = "caught";
    return this.currentView();
  }

  currentView(): DialogueView {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node) {
      return {
        speaker: this.speaker,
        role: this.role,
        text: "We never had this conversation.",
        choices: [],
        canAdvance: true,
      };
    }
    return {
      speaker: this.speaker,
      role: this.role,
      text: node.text,
      choices: node.choices ?? [],
      canAdvance: !node.choices || node.choices.length === 0,
    };
  }

  advanceDialogue(): boolean {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node) {
      this.endDialogue();
      return true;
    }
    if (node.choices && node.choices.length > 0) return false;
    if (node.next && this.nodes.has(node.next)) {
      this.currentId = node.next;
      return false;
    }
    this.endDialogue();
    return true;
  }

  chooseDialogue(index: number): boolean {
    const node = this.currentId ? this.nodes.get(this.currentId) : undefined;
    if (!node || !node.choices) return false;
    const choice = node.choices[index];
    if (!choice || !this.nodes.has(choice.next)) return false;
    this.currentId = choice.next;
    return true;
  }

  endDialogue(): void {
    this.currentId = null;
    this.nodes.clear();
    this.mode = null;
  }

  private add(node: DialogueNode): void {
    this.nodes.set(node.id, node);
  }
}
