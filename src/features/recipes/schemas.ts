import { z } from "zod";

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
export const DIFFICULTY_LABELS: Record<(typeof DIFFICULTIES)[number], string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

export const LIMITS = {
  title: 120,
  description: 2000,
  ingredients: 60,
  steps: 40,
  stepText: 2000,
  tags: 10,
  minutes: 24 * 60,
  servings: 100,
} as const;

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer`);

const minutes = (label: string) =>
  z
    .number({ error: `Enter ${label.toLowerCase()} in minutes` })
    .int("Use whole minutes")
    .min(0, "Cannot be negative")
    .max(LIMITS.minutes, "Must be 24 hours or less");

export const ingredientSchema = z.object({
  quantity: optionalText(20, "Quantity"),
  unit: optionalText(30, "Unit"),
  name: z.string().trim().min(1, "Enter the ingredient").max(100, "Use 100 characters or fewer"),
  note: optionalText(100, "Note"),
});

export const stepSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Describe this step")
    .max(LIMITS.stepText, `Use ${LIMITS.stepText} characters or fewer`),
});

export const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1)
  .max(30, "Tags must be 30 characters or fewer")
  .regex(/^[a-z0-9][a-z0-9 -]*$/, "Tags can use letters, numbers, spaces, and dashes");

export const recipeSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Use at least 3 characters")
    .max(LIMITS.title, `Use ${LIMITS.title} characters or fewer`),
  description: z
    .string()
    .trim()
    .min(1, "Add a short description")
    .max(LIMITS.description, `Use ${LIMITS.description} characters or fewer`),
  imageUrl: z.string().trim().max(500).nullable(),
  prepMinutes: minutes("Prep time"),
  cookMinutes: minutes("Cook time"),
  servings: z
    .number({ error: "Enter the number of servings" })
    .int("Use a whole number")
    .min(1, "At least 1 serving")
    .max(LIMITS.servings, `At most ${LIMITS.servings} servings`),
  difficulty: z.enum(DIFFICULTIES, { error: "Choose a difficulty" }),
  // "middle  eastern" -> "Middle Eastern", so filters do not list case variants.
  cuisine: optionalText(50, "Cuisine").transform((v) =>
    v
      .replace(/\s+/g, " ")
      .replace(/(^|\s)(\p{L})/gu, (_, space, letter) => space + letter.toUpperCase()),
  ),
  tags: z
    .array(tagSchema)
    .max(LIMITS.tags, `Use up to ${LIMITS.tags} tags`)
    .transform((tags) => [...new Set(tags)]),
  ingredients: z
    .array(ingredientSchema)
    .min(1, "Add at least one ingredient")
    .max(LIMITS.ingredients, `Use up to ${LIMITS.ingredients} ingredients`),
  steps: z
    .array(stepSchema)
    .min(1, "Add at least one step")
    .max(LIMITS.steps, `Use up to ${LIMITS.steps} steps`),
});

export type RecipeInput = z.input<typeof recipeSchema>;
export type RecipeData = z.output<typeof recipeSchema>;

export const emptyRecipe: RecipeInput = {
  title: "",
  description: "",
  imageUrl: null,
  prepMinutes: 10,
  cookMinutes: 20,
  servings: 4,
  difficulty: "EASY",
  cuisine: "",
  tags: [],
  ingredients: [{ quantity: "", unit: "", name: "", note: "" }],
  steps: [{ text: "" }],
};

// Search and filter params for the recipe list. Bad values are dropped, not errors.
export const recipeFiltersSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  cuisine: z.string().trim().max(50).optional().catch(undefined),
  difficulty: z.enum(DIFFICULTIES).optional().catch(undefined),
  tag: z.string().trim().toLowerCase().max(30).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1000).optional().catch(undefined),
});

export type RecipeFilters = z.output<typeof recipeFiltersSchema>;
