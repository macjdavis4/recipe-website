import type { RecipeDetail } from "./queries";
import type { RecipeInput } from "./schemas";

/** Maps a stored recipe to the form's input shape (nulls become empty strings). */
export function toFormValues(recipe: RecipeDetail): RecipeInput {
  return {
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    prepMinutes: recipe.prepMinutes,
    cookMinutes: recipe.cookMinutes,
    servings: recipe.servings,
    difficulty: recipe.difficulty,
    cuisine: recipe.cuisine ?? "",
    tags: recipe.tags,
    ingredients: recipe.ingredients.map((i) => ({
      quantity: i.quantity ?? "",
      unit: i.unit ?? "",
      name: i.name,
      note: i.note ?? "",
    })),
    steps: recipe.steps.map((s) => ({ text: s.text })),
  };
}
