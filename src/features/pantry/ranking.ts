import "server-only";
import { db } from "@/lib/db";
import { getRecipeCards, type RecipeCardData } from "@/features/recipes/queries";
import { matchesAny } from "./matching";

export type PantryMatch = {
  recipe: RecipeCardData;
  matched: number;
  total: number;
  missing: string[];
};

const LIMIT = 12;

/**
 * Community recipes ranked by how few ingredients you are missing, then by
 * how many you have. Matching runs in SQL on normalized names with
 * whole-word regex (\m and \M). Items are normalized ([a-z0-9 -] only) and
 * passed as a bound array parameter.
 */
export async function rankRecipesByPantry(items: string[]): Promise<PantryMatch[]> {
  if (items.length === 0) return [];

  const rows = await db.$queryRaw<{ id: string; total: number; matched: number }[]>`
    WITH pantry AS (SELECT unnest(${items}::text[]) AS item),
    scored AS (
      SELECT i."recipeId" AS id,
             COUNT(*)::int AS total,
             (COUNT(*) FILTER (
               WHERE EXISTS (SELECT 1 FROM pantry p WHERE i."normalizedName" ~ ('\\m' || p.item || '\\M'))
             ))::int AS matched
      FROM "Ingredient" i
      GROUP BY i."recipeId"
    )
    SELECT s.id, s.total, s.matched
    FROM scored s
    JOIN "Recipe" r ON r.id = s.id
    WHERE s.matched > 0
    ORDER BY (s.total - s.matched) ASC, s.matched DESC, r."createdAt" DESC
    LIMIT ${LIMIT}
  `;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const [cards, ingredients] = await Promise.all([
    getRecipeCards(ids),
    db.ingredient.findMany({
      where: { recipeId: { in: ids } },
      select: { recipeId: true, name: true, normalizedName: true },
      orderBy: { position: "asc" },
    }),
  ]);

  return rows.flatMap(({ id, total, matched }) => {
    const recipe = cards.get(id);
    if (!recipe) return [];
    const missing = ingredients
      .filter((i) => i.recipeId === id && !matchesAny(i.normalizedName, items))
      .map((i) => i.name);
    return [{ recipe, total, matched, missing }];
  });
}
