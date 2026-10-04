import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { RecipeForm } from "@/features/recipes/components/form/recipe-form";
import { emptyRecipe } from "@/features/recipes/schemas";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Share a recipe" };

export default async function NewRecipePage() {
  // Middleware redirects guests too; this is the server-side guarantee.
  if (!(await auth())?.user) redirect("/login?callbackUrl=%2Frecipes%2Fnew");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-semibold md:text-4xl">Share a recipe</h1>
      <RecipeForm defaultValues={emptyRecipe} cancelHref="/recipes" />
    </div>
  );
}
