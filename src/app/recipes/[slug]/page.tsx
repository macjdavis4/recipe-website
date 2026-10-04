import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Badge } from "@/components/ui/badge";
import { AskAboutRecipe } from "@/features/ai/ask-about-recipe";
import { IngredientsPanel } from "@/features/recipes/components/ingredients-panel";
import { OwnerActions } from "@/features/recipes/components/owner-actions";
import { RecipeImage } from "@/features/recipes/components/recipe-image";
import { formatMinutes } from "@/features/recipes/format";
import { getRecipeBySlug } from "@/features/recipes/queries";
import { DIFFICULTY_LABELS } from "@/features/recipes/schemas";
import { auth } from "@/lib/auth";

type Props = { params: Promise<{ slug: string }> };

const loadRecipe = cache(getRecipeBySlug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const recipe = await loadRecipe((await params).slug);
  return recipe ? { title: recipe.title, description: recipe.description.slice(0, 160) } : {};
}

export default async function RecipePage({ params }: Props) {
  const [recipe, session] = await Promise.all([loadRecipe((await params).slug), auth()]);
  if (!recipe) notFound();
  // UI convenience only. The actions check ownership on the server.
  const isOwner = session?.user?.id === recipe.authorId;

  const facts = [
    ["Prep", formatMinutes(recipe.prepMinutes)],
    ["Cook", formatMinutes(recipe.cookMinutes)],
    ["Total", formatMinutes(recipe.prepMinutes + recipe.cookMinutes)],
    ["Difficulty", DIFFICULTY_LABELS[recipe.difficulty]],
    ...(recipe.cuisine ? [["Cuisine", recipe.cuisine]] : []),
  ];

  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="flex flex-col gap-4">
        <h1 className="text-3xl font-semibold text-balance md:text-5xl">{recipe.title}</h1>
        <p className="text-muted-foreground">
          Shared by{" "}
          <Link
            href={`/u/${recipe.author.id}`}
            className="inline-flex min-h-11 items-center font-medium text-primary underline underline-offset-4"
          >
            {recipe.author.name ?? "a home cook"}
          </Link>
        </p>
        {isOwner && <OwnerActions recipeId={recipe.id} slug={recipe.slug} title={recipe.title} />}
      </header>

      <RecipeImage
        src={recipe.imageUrl}
        alt={recipe.title}
        sizes="(min-width: 896px) 896px, 100vw"
        priority
        className="rounded-xl"
      />

      <p className="text-lg">{recipe.description}</p>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-card p-3">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>

      {recipe.tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tags">
          {recipe.tags.map((tag) => (
            <li key={tag}>
              <Badge asChild variant="secondary" className="h-auto min-h-11 px-3 text-sm">
                <Link href={`/recipes?tag=${encodeURIComponent(tag)}`}>{tag}</Link>
              </Badge>
            </li>
          ))}
        </ul>
      )}

      <div className="grid gap-10 md:grid-cols-[2fr_3fr]">
        <IngredientsPanel servings={recipe.servings} ingredients={recipe.ingredients} />
        <section aria-labelledby="steps-title" className="flex flex-col gap-4">
          <h2 id="steps-title" className="text-2xl font-semibold">
            Steps
          </h2>
          <ol className="flex flex-col gap-5">
            {recipe.steps.map((step, index) => (
              <li key={step.id} className="flex gap-4">
                <span
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <p className="pt-1 whitespace-pre-line">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <AskAboutRecipe recipeId={recipe.id} slug={recipe.slug} signedIn={Boolean(session?.user)} />
    </article>
  );
}
