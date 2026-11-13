export type GardenItemId = "tomato" | "potato" | "carrot" | "cabbage";

export interface GardenItem {
  id: GardenItemId;
  name: string;
  shortName: string;
  /** The fictional game prop found during Operation Midnight Mischief. */
  markerName: string;
  markerShortName: string;
}

export const GARDEN_ITEMS: readonly GardenItem[] = [
  {
    id: "tomato",
    name: "Tomatoes",
    shortName: "Tomato",
    markerName: "Tomato marker",
    markerShortName: "Tomato marker",
  },
  {
    id: "potato",
    name: "Potatoes",
    shortName: "Potato",
    markerName: "Potato marker",
    markerShortName: "Potato marker",
  },
  {
    id: "carrot",
    name: "Carrots",
    shortName: "Carrot",
    markerName: "Carrot marker",
    markerShortName: "Carrot marker",
  },
  {
    id: "cabbage",
    name: "Cabbage",
    shortName: "Cabbage",
    markerName: "Cabbage marker",
    markerShortName: "Cabbage marker",
  },
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

export const NIGHT_MISSION_TITLE = "Operation Midnight Mischief";

export const NIGHT_STEPS: readonly NightStepDefinition[] = [
  {
    id: "meet-roommate",
    title: "Lights out",
    objective: "Talk to your roommate in the house hostel",
    hint: "Keep your voice down. The corridor lights are already off.",
  },
  {
    id: "garden-challenge",
    title: "The midnight game",
    objective: "Hear the rules of Operation Midnight Mischief",
    hint: "A fictional campus game. No produce leaves the garden.",
  },
  {
    id: "reach-garden",
    title: "Out of the hostel",
    objective: "Reach the garden game zone",
    hint: "Leave the hostel quietly and cross the south lawn.",
  },
  {
    id: "collect-vegetables",
    title: "The markers",
    objective: "Find four fictional garden markers",
    hint: "One of each: tomato, potato, carrot and cabbage marker.",
  },
  {
    id: "return-home",
    title: "The way back",
    objective: "Return the markers to your house hostel",
    hint: "Stay low, watch the patrols, and do not run in the open.",
  },
];

export const NIGHT_TOTAL_STEPS = NIGHT_STEPS.length;
