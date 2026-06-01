export type MealSlot =
  | "BREAKFAST"
  | "SNACK_AM"
  | "LUNCH"
  | "SNACK_PM"
  | "DINNER"
  | "CUSTOM";

const SLUG_TO_SLOT: Record<string, MealSlot> = {
  breakfast: "BREAKFAST",
  "snack-am": "SNACK_AM",
  lunch: "LUNCH",
  "snack-pm": "SNACK_PM",
  dinner: "DINNER",
};

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  BREAKFAST: "Desayuno",
  SNACK_AM: "Colación",
  LUNCH: "Almuerzo",
  SNACK_PM: "Merienda",
  DINNER: "Cena",
  CUSTOM: "Otra comida",
};

export function slotFromSlug(slug: string | undefined | null): MealSlot {
  if (!slug) return "CUSTOM";
  return SLUG_TO_SLOT[slug] ?? "CUSTOM";
}

export function slotLabel(slot: MealSlot): string {
  return MEAL_SLOT_LABEL[slot];
}
