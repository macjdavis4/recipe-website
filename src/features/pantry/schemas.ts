import { z } from "zod";
import { normalizeIngredientName } from "@/features/recipes/normalize";
import { DIFFICULTIES, type RecipeInput } from "@/features/recipes/schemas";

export const PANTRY_LIMITS = { items: 30, itemChars: 50 } as const;

/** "Eggs, rice\nspinach " -> ["egg", "rice", "spinach"] (normalized, unique, capped). */
export function parsePantryText(text: string): string[] {
  const items = text
    .split(/[,\n;]/)
    .map((s) => normalizeIngredientName(s.slice(0, PANTRY_LIMITS.itemChars)))
    .filter(Boolean);
  return [...new Set(items)].slice(0, PANTRY_LIMITS.items);
}

export const pantryRequestSchema = z.object({
  items: z
    .array(z.string().trim().min(1).max(PANTRY_LIMITS.itemChars))
    .min(1, "List at least one ingredient.")
    .max(PANTRY_LIMITS.items, `List up to ${PANTRY_LIMITS.items} ingredients.`)
    .transform((items) => parsePantryText(items.join("\n")))
    .refine((items) => items.length > 0, "List at least one ingredient."),
});

// What we ask the model for. Kept loose (no length rules) so it maps cleanly
// to a JSON schema; everything is validated strictly below before use.
export const pantryIdeasShape = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      prepMinutes: z.number(),
      cookMinutes: z.number(),
      servings: z.number(),
      difficulty: z.enum(DIFFICULTIES),
      ingredients: z.array(z.object({ quantity: z.string(), unit: z.string(), name: z.string() })),
      steps: z.array(z.string()),
      usesFromPantry: z.array(z.string()),
      missing: z.array(z.string()),
    }),
  ),
});

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const minutes = z
  .number()
  .int()
  .min(0)
  .max(24 * 60);

/** Strict validation of AI output before it is shown or saved (CLAUDE.md rule 4). */
export const pantryIdeasSchema = z.object({
  ideas: z
    .array(
      z.object({
        title: text(3, 120),
        description: text(1, 400),
        prepMinutes: minutes,
        cookMinutes: minutes,
        servings: z.number().int().min(1).max(100),
        difficulty: z.enum(DIFFICULTIES),
        ingredients: z
          .array(z.object({ quantity: text(0, 20), unit: text(0, 30), name: text(1, 100) }))
          .min(1)
          .max(40),
        steps: z.array(text(1, 1000)).min(1).max(20),
        usesFromPantry: z.array(text(1, 100)).max(30),
        missing: z.array(text(1, 100)).max(30),
      }),
    )
    .min(1)
    .max(3),
});

export type PantryIdea = z.infer<typeof pantryIdeasSchema>["ideas"][number];

/** Turns an AI idea into recipe form values for "Save as my recipe". */
export function ideaToRecipeInput(idea: PantryIdea): RecipeInput {
  return {
    title: idea.title,
    description: idea.description,
    imageUrl: null,
    prepMinutes: idea.prepMinutes,
    cookMinutes: idea.cookMinutes,
    servings: idea.servings,
    difficulty: idea.difficulty,
    cuisine: "",
    tags: [],
    ingredients: idea.ingredients.map((i) => ({ ...i, note: "" })),
    steps: idea.steps.map((s) => ({ text: s })),
  };
}
