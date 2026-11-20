import type { MessRunFoodKind } from "../messrun/messRunData";

/** The food kinds a house cupboard can store. Kept in sync with MESS RUN. */
export type CupboardFoodId = MessRunFoodKind;

export const CUPBOARD_FOOD_ORDER: readonly CupboardFoodId[] = [
  "chicken",
  "fries",
  "samosa",
  "burger",
  "coldDrink",
] as const;

export const CUPBOARD_FOOD_LABELS: Record<CupboardFoodId, string> = {
  chicken: "Fried chicken",
  fries: "French fries",
  samosa: "Samosas",
  burger: "Burgers",
  coldDrink: "Cold drinks",
};

export const CUPBOARD_FOOD_SHORT_LABELS: Record<CupboardFoodId, string> = {
  chicken: "Chicken",
  fries: "Fries",
  samosa: "Samosa",
  burger: "Burger",
  coldDrink: "Cold drink",
};

export interface CupboardInventory {
  chicken: number;
  fries: number;
  samosa: number;
  burger: number;
  coldDrink: number;
}

export const EMPTY_CUPBOARD_INVENTORY: CupboardInventory = {
  chicken: 0,
  fries: 0,
  samosa: 0,
  burger: 0,
  coldDrink: 0,
};

export function isCupboardFoodId(value: unknown): value is CupboardFoodId {
  return (
    value === "chicken" ||
    value === "fries" ||
    value === "samosa" ||
    value === "burger" ||
    value === "coldDrink"
  );
}

export function cupboardTotal(items: CupboardInventory): number {
  return CUPBOARD_FOOD_ORDER.reduce((total, id) => total + Math.max(0, items[id] ?? 0), 0);
}
