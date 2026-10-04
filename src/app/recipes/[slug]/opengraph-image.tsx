import { formatMinutes } from "@/features/recipes/format";
import { getRecipeBySlug } from "@/features/recipes/queries";
import { ogCard, OG_SIZE } from "@/lib/og";
import { SITE_NAME } from "@/lib/site";

export const alt = "Recipe preview";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const recipe = await getRecipeBySlug((await params).slug);
  if (!recipe) return ogCard({ eyebrow: "Recipe", title: "Recipe not found", footer: SITE_NAME });

  const facts = [recipe.cuisine, formatMinutes(recipe.prepMinutes + recipe.cookMinutes)]
    .filter(Boolean)
    .join(" · ");
  return ogCard({
    eyebrow: facts || "Recipe",
    title: recipe.title,
    footer: `${recipe.author.name ? `By ${recipe.author.name} on ` : ""}${SITE_NAME}`,
  });
}
