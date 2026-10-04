import type { Metadata } from "next";
import { PantryForm } from "@/features/pantry/components/pantry-form";
import { PantryIdeas } from "@/features/pantry/components/pantry-ideas";
import { STAPLES } from "@/features/pantry/matching";
import { rankRecipesByPantry } from "@/features/pantry/ranking";
import { parsePantryText } from "@/features/pantry/schemas";
import { RecipeCard } from "@/features/recipes/components/recipe-card";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Cook from your pantry" };

type Search = { have?: string | string[]; staples?: string | string[] };

export default async function PantryPage({ searchParams }: { searchParams: Promise<Search> }) {
  const params = await searchParams;
  const have = typeof params.have === "string" ? params.have.slice(0, 2000) : "";
  // Staples default on for a first visit; after that the checkbox decides.
  const staples = params.have === undefined ? true : params.staples === "1";
  const items = parsePantryText(have);
  const searchItems = staples ? [...new Set([...items, ...STAPLES])] : items;

  const [matches, session] = await Promise.all([
    items.length ? rankRecipesByPantry(searchItems) : Promise.resolve([]),
    auth(),
  ]);
  const query = new URLSearchParams({ have, ...(staples ? { staples: "1" } : {}) }).toString();

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold md:text-4xl">Cook from your pantry</h1>
        <p className="text-muted-foreground">
          List what you have. We will find community recipes that use it, and AI can suggest more.
        </p>
      </header>
      <PantryForm have={have} staples={staples} />

      {items.length > 0 && (
        <>
          <section aria-labelledby="matches-title" className="flex flex-col gap-4">
            <h2 id="matches-title" className="text-2xl font-semibold">
              Community recipes
            </h2>
            {matches.length > 0 ? (
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {matches.map(({ recipe, matched, total, missing }) => (
                  <li key={recipe.id} className="flex">
                    <RecipeCard recipe={recipe}>
                      <p className="text-sm font-medium">
                        You have {matched} of {total} ingredients
                      </p>
                      {missing.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          Missing: {missing.join(", ")}
                        </p>
                      )}
                    </RecipeCard>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
                No community recipes use these yet. Try the AI ideas below.
              </p>
            )}
          </section>

          <section aria-labelledby="ideas-title" className="flex flex-col gap-4">
            <h2 id="ideas-title" className="text-2xl font-semibold">
              AI ideas
            </h2>
            <PantryIdeas
              items={items}
              signedIn={Boolean(session?.user)}
              loginHref={`/login?callbackUrl=${encodeURIComponent(`/pantry?${query}`)}`}
            />
          </section>
        </>
      )}
    </div>
  );
}
