import { describe, expect, it } from "vitest";
import { emptyRecipe, recipeFiltersSchema, recipeSchema } from "./schemas";

const valid = {
  ...emptyRecipe,
  title: "  Weeknight Dal ",
  description: "Red lentils, spices, and rice.",
  tags: ["Vegan", "vegan", "quick"],
  ingredients: [{ quantity: "1 1/2", unit: "cups", name: "red lentils", note: "rinsed" }],
  steps: [{ text: "Simmer until soft." }],
};

describe("recipeSchema", () => {
  it("accepts a valid recipe, trimming text and de-duplicating lowercased tags", () => {
    const data = recipeSchema.parse(valid);
    expect(data.title).toBe("Weeknight Dal");
    expect(data.tags).toEqual(["vegan", "quick"]);
  });

  it("requires at least one ingredient and one step", () => {
    const result = recipeSchema.safeParse({ ...valid, ingredients: [], steps: [] });
    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["ingredients", "steps"]));
  });

  it("rejects blank ingredient names and steps", () => {
    expect(
      recipeSchema.safeParse({ ...valid, ingredients: [{ ...valid.ingredients[0], name: " " }] })
        .success,
    ).toBe(false);
    expect(recipeSchema.safeParse({ ...valid, steps: [{ text: "  " }] }).success).toBe(false);
  });

  it("bounds times and servings", () => {
    expect(recipeSchema.safeParse({ ...valid, prepMinutes: -1 }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...valid, cookMinutes: 1.5 }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...valid, servings: 0 }).success).toBe(false);
    expect(recipeSchema.safeParse({ ...valid, servings: Number.NaN }).success).toBe(false);
  });

  it("rejects tags with odd characters and too many tags", () => {
    expect(recipeSchema.safeParse({ ...valid, tags: ["<script>"] }).success).toBe(false);
    const many = Array.from({ length: 11 }, (_, i) => `tag${i}`);
    expect(recipeSchema.safeParse({ ...valid, tags: many }).success).toBe(false);
  });

  it("rejects an unknown difficulty", () => {
    expect(recipeSchema.safeParse({ ...valid, difficulty: "EXTREME" }).success).toBe(false);
  });
});

describe("recipeFiltersSchema", () => {
  it("drops invalid values instead of failing", () => {
    expect(recipeFiltersSchema.parse({ difficulty: "nope", page: "-3", q: " soup " })).toEqual({
      q: "soup",
      difficulty: undefined,
      page: undefined,
      cuisine: undefined,
      tag: undefined,
    });
  });

  it("coerces the page number", () => {
    expect(recipeFiltersSchema.parse({ page: "2" }).page).toBe(2);
  });
});
