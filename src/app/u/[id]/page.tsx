import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { RecipeGrid } from "@/features/recipes/components/recipe-card";
import { getProfile } from "@/features/recipes/queries";

type Props = { params: Promise<{ id: string }> };

const loadProfile = cache(getProfile);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const user = await loadProfile((await params).id);
  return user ? { title: user.name ?? "Home cook" } : {};
}

export default async function ProfilePage({ params }: Props) {
  const user = await loadProfile((await params).id);
  if (!user) notFound();
  const joined = user.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-3xl font-semibold md:text-4xl">{user.name ?? "Home cook"}</h1>
        <p className="text-muted-foreground">
          Joined {joined} ·{" "}
          {user.recipes.length === 1 ? "1 recipe" : `${user.recipes.length} recipes`}
        </p>
      </header>
      {user.recipes.length > 0 ? (
        <RecipeGrid recipes={user.recipes} />
      ) : (
        <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
          No recipes shared yet.
        </p>
      )}
    </div>
  );
}
