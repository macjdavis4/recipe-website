"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { draftKeyFor } from "@/features/recipes/components/form/use-form-draft";
import { formatMinutes, ingredientLine } from "@/features/recipes/format";
import { DIFFICULTY_LABELS } from "@/features/recipes/schemas";
import { ideaToRecipeInput, type PantryIdea } from "../schemas";

type Props = { items: string[]; signedIn: boolean; loginHref: string };

export function PantryIdeas({ items, signedIn, loginHref }: Props) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<PantryIdea[]>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function suggest() {
    setLoading(true);
    setError(undefined);
    try {
      const res = await fetch("/api/ai/pantry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong. Try again.");
      setIdeas(json.ideas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function save(idea: PantryIdea) {
    try {
      // The new-recipe form restores this as a draft the user can review and edit.
      sessionStorage.setItem(draftKeyFor(), JSON.stringify(ideaToRecipeInput(idea)));
    } catch {
      setError("Your browser blocked saving the draft. Copy the recipe by hand instead.");
      return;
    }
    router.push("/recipes/new");
  }

  if (!signedIn) {
    return (
      <p className="text-muted-foreground">
        <Link
          href={loginHref}
          className="inline-flex min-h-11 items-center font-medium text-primary underline"
        >
          Log in to get AI recipe ideas
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={loading}>
      <Button onClick={suggest} disabled={loading || items.length === 0} className="self-start">
        <Sparkles aria-hidden="true" />
        {loading
          ? "Thinking of ideas..."
          : ideas
            ? "Suggest different ideas"
            : "Suggest recipes with AI"}
      </Button>
      <FormAlert message={error} />
      {ideas && (
        <ul className="grid gap-4 md:grid-cols-3" aria-label="AI recipe ideas">
          {ideas.map((idea, index) => (
            <li
              key={`${idea.title}-${index}`}
              className="flex flex-col gap-3 rounded-xl border bg-card p-4"
            >
              <h3 className="text-lg font-semibold">{idea.title}</h3>
              <p className="text-sm text-muted-foreground">
                {formatMinutes(idea.prepMinutes + idea.cookMinutes)} ·{" "}
                {DIFFICULTY_LABELS[idea.difficulty]} · Serves {idea.servings}
              </p>
              <p>{idea.description}</p>
              {idea.usesFromPantry.length > 0 && (
                <p className="text-sm">
                  <span className="font-medium">Uses:</span> {idea.usesFromPantry.join(", ")}
                </p>
              )}
              {idea.missing.length > 0 && (
                <p className="text-sm">
                  <span className="font-medium">You also need:</span> {idea.missing.join(", ")}
                </p>
              )}
              <details className="text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center font-medium text-primary">
                  Ingredients and steps
                </summary>
                <ul className="mt-2 list-disc pl-5">
                  {idea.ingredients.map((i, n) => (
                    <li key={n}>{ingredientLine(i)}</li>
                  ))}
                </ul>
                <ol className="mt-3 list-decimal pl-5">
                  {idea.steps.map((step, n) => (
                    <li key={n}>{step}</li>
                  ))}
                </ol>
              </details>
              <Button variant="outline" className="mt-auto" onClick={() => save(idea)}>
                Save as my recipe
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        AI ideas can be wrong. Check cooking times and food safety.
      </p>
    </div>
  );
}
