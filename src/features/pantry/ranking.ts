import "server-only";
import { db } from "@/lib/db";
import { getRecipeCards, type RecipeCardData } from "@/features/recipes/queries";
import { matchesAny, STAPLES } from "./matching";

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
 * passed as bound array parameters. Staples count toward the score, but a
 * recipe only appears if it uses at least one item the user listed.
 */
export async function rankRecipesByPantry(
  items: string[],
  { staples }: { staples: boolean },
): Promise<PantryMatch[]> {
  if (items.length === 0) return [];
  const available = staples ? [...new Set([...items, ...STAPLES])] : items;

  const rows = await db.$queryRaw<{ id: string; total: number; matched: number }[]>`
    WITH available AS (SELECT unnest(${available}::text[]) AS item),
    listed AS (SELECT unnest(${items}::text[]) AS item),
    scored AS (
      SELECT i."recipeId" AS id,
             COUNT(*)::int AS total,
             (COUNT(*) FILTER (
               WHERE EXISTS (SELECT 1 FROM available a WHERE i."normalizedName" ~ ('\\m' || a.item || '\\M'))
             ))::int AS matched,
             (COUNT(*) FILTER (
               WHERE EXISTS (SELECT 1 FROM listed l WHERE i."normalizedName" ~ ('\\m' || l.item || '\\M'))
             ))::int AS listed_matched
      FROM "Ingredient" i
      GROUP BY i."recipeId"
    )
    SELECT s.id, s.total, s.matched
    FROM scored s
    JOIN "Recipe" r ON r.id = s.id
    WHERE s.listed_matched > 0
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
      .filter((i) => i.recipeId === id && !matchesAny(i.normalizedName, available))
      .map((i) => i.name);
    return [{ recipe, total, matched, missing }];
  });
}
