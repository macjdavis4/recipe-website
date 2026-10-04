import type { Metadata } from "next";
import { forbidden, notFound, redirect } from "next/navigation";
import { RecipeForm } from "@/features/recipes/components/form/recipe-form";
import { assertRecipeOwner } from "@/features/recipes/ownership";
import { getRecipeBySlug } from "@/features/recipes/queries";
import { toFormValues } from "@/features/recipes/to-form-values";
import { auth } from "@/lib/auth";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

export const metadata: Metadata = { title: "Edit recipe" };

export default async function EditRecipePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/login?callbackUrl=${encodeURIComponent(`/recipes/${slug}/edit`)}`);

  const recipe = await getRecipeBySlug(slug);
  if (!recipe) notFound();
  try {
    await assertRecipeOwner(recipe.id, session.user.id);
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-semibold md:text-4xl">Edit recipe</h1>
      <RecipeForm
        recipeId={recipe.id}
        defaultValues={toFormValues(recipe)}
        cancelHref={`/recipes/${slug}`}
      />
    </div>
  );
}
