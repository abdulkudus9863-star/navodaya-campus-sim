export type GardenItemId = "tomato" | "potato" | "carrot" | "cabbage";

export interface GardenItem {
  id: GardenItemId;
  name: string;
  shortName: string;
}

export const GARDEN_ITEMS: readonly GardenItem[] = [
  { id: "tomato", name: "Tomatoes", shortName: "Tomato" },
  { id: "potato", name: "Potatoes", shortName: "Potato" },
  { id: "carrot", name: "Carrots", shortName: "Carrot" },
  { id: "cabbage", name: "Cabbage", shortName: "Cabbage" },
];

export const GARDEN_ITEM_IDS: readonly GardenItemId[] = GARDEN_ITEMS.map((item) => item.id);

export function isGardenItemId(value: unknown): value is GardenItemId {
  return typeof value === "string" && GARDEN_ITEM_IDS.includes(value as GardenItemId);
}

export function gardenItem(id: GardenItemId): GardenItem {
  const item = GARDEN_ITEMS.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Unknown garden item: ${id}`);
  return item;
}

export interface NightStepDefinition {
  id: string;
  title: string;
  objective: string;
  hint: string;
}

export const NIGHT_MISSION_TITLE = "Night Life · Midnight Garden Run";

export const NIGHT_STEPS: readonly NightStepDefinition[] = [
  {
    id: "meet-roommate",
    title: "Lights out",
    objective: "Talk to your roommate in the house hostel",
    hint: "Keep your voice down. The corridor lights are already off.",
  },
  {
    id: "garden-challenge",
    title: "The challenge",
    objective: "Hear the roommate's garden challenge",
    hint: "Four vegetables. The mess pantry is not part of the plan.",
  },
  {
    id: "reach-garden",
    title: "Out of the hostel",
    objective: "Reach the teachers' kitchen garden",
    hint: "Leave the hostel quietly and cross the south lawn.",
  },
  {
    id: "collect-vegetables",
    title: "The harvest",
    objective: "Collect four vegetables from the garden",
    hint: "One of each: tomato, potato, carrot and cabbage.",
  },
  {
    id: "return-home",
    title: "The way back",
    objective: "Return to your house hostel",
    hint: "Stay low, watch the patrols, and do not run in the open.",
  },
];

export const NIGHT_TOTAL_STEPS = NIGHT_STEPS.length;
