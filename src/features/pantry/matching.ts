import { normalizeIngredientName } from "@/features/recipes/normalize";

/** Assumed to be in every kitchen when the "staples" option is on. */
export const STAPLES = [
  "salt",
  "black pepper",
  "pepper",
  "water",
  "oil",
  "olive oil",
  "vegetable oil",
].map(normalizeIngredientName);

/**
 * True when a pantry item appears as whole words in a normalized ingredient
 * name: "lentil" matches "red lentil", "oil" does not match "boil". Mirrors
 * the \m...\M regex used in the SQL ranking.
 */
export function ingredientMatches(normalizedName: string, item: string): boolean {
  const escaped = item.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`).test(normalizedName);
}

export function matchesAny(normalizedName: string, items: string[]): boolean {
  return items.some((item) => ingredientMatches(normalizedName, item));
}
