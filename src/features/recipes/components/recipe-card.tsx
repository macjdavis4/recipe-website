import Link from "next/link";
import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMinutes } from "../format";
import type { RecipeCardData } from "../queries";
import { DIFFICULTY_LABELS } from "../schemas";
import { RecipeImage } from "./recipe-image";

export function RecipeCard({ recipe, priority }: { recipe: RecipeCardData; priority?: boolean }) {
  const total = recipe.prepMinutes + recipe.cookMinutes;

  return (
    <article className="group relative flex w-full flex-col overflow-hidden rounded-xl border bg-card text-card-foreground transition-shadow focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-md">
      <RecipeImage
        src={recipe.imageUrl}
        alt={recipe.title}
        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
        priority={priority}
      />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-lg leading-snug font-semibold">
          {/* The stretched link makes the whole card clickable with one tab stop. */}
          <Link
            href={`/recipes/${recipe.slug}`}
            className="outline-none after:absolute after:inset-0"
          >
            {recipe.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{recipe.description}</p>
        <p className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden="true" />
            {formatMinutes(total)}
          </span>
          <span>{DIFFICULTY_LABELS[recipe.difficulty]}</span>
          {recipe.cuisine && <span>{recipe.cuisine}</span>}
        </p>
        {recipe.tags.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
            {recipe.tags.slice(0, 3).map((tag) => (
              <li key={tag}>
                <Badge variant="secondary">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}
        {recipe.author.name && (
          <p className="text-sm text-muted-foreground">by {recipe.author.name}</p>
        )}
      </div>
    </article>
  );
}

export function RecipeGrid({ recipes }: { recipes: RecipeCardData[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {recipes.map((recipe, index) => (
        <li key={recipe.id} className="flex">
          {/* The first card is usually the largest image above the fold. */}
          <RecipeCard recipe={recipe} priority={index === 0} />
        </li>
      ))}
    </ul>
  );
}
