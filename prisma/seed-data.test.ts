import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { recipeSchema } from "../src/features/recipes/schemas";
import { slugify } from "../src/features/recipes/slug";
import { SEED_RECIPES, SEED_USERS } from "./seed-data";

describe("seed data", () => {
  it.each(SEED_RECIPES.map((r) => [r.slug, r] as const))(
    "%s passes the recipe schema",
    (_slug, recipe) => {
      expect(recipeSchema.safeParse(recipe).success).toBe(true);
    },
  );

  it("uses unique, valid slugs and known authors", () => {
    const slugs = SEED_RECIPES.map((r) => r.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const recipe of SEED_RECIPES) {
      expect(slugify(recipe.slug)).toBe(recipe.slug);
      expect(SEED_USERS.map((u) => u.key)).toContain(recipe.author);
    }
  });

  it("points at images that exist in public/", () => {
    for (const recipe of SEED_RECIPES) {
      expect(existsSync(path.join(process.cwd(), "public", recipe.imageUrl))).toBe(true);
    }
  });
});
