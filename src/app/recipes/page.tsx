import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/features/recipes/components/pagination";
import { RecipeGrid } from "@/features/recipes/components/recipe-card";
import { RecipeFilters } from "@/features/recipes/components/recipe-filters";
import { getFilterOptions, listRecipes } from "@/features/recipes/queries";
import { recipeFiltersSchema } from "@/features/recipes/schemas";

export const metadata: Metadata = { title: "Recipes" };

export default async function RecipesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = recipeFiltersSchema.parse(await searchParams);
  const [{ recipes, total, page, pageCount }, options] = await Promise.all([
    listRecipes(filters),
    getFilterOptions(),
  ]);
  const filtered = Boolean(filters.q || filters.cuisine || filters.difficulty || filters.tag);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold md:text-4xl">Recipes</h1>
          <p className="text-muted-foreground" aria-live="polite">
            {total === 1 ? "1 recipe" : `${total} recipes`}
            {filtered && " match your search"}
          </p>
        </div>
        <Button asChild>
          <Link href="/recipes/new">
            <Plus aria-hidden="true" />
            Share a recipe
          </Link>
        </Button>
      </div>
      <RecipeFilters filters={filters} cuisines={options.cuisines} tags={options.tags} />
      {recipes.length > 0 ? (
        <RecipeGrid recipes={recipes} />
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <h2 className="text-xl font-semibold">
            {filtered ? "No recipes match" : "No recipes yet"}
          </h2>
          <p className="mt-1 text-muted-foreground">
            {filtered
              ? "Try a different search or clear the filters."
              : "Be the first to share one."}
          </p>
        </div>
      )}
      <Pagination filters={filters} page={page} pageCount={pageCount} />
    </div>
  );
}
