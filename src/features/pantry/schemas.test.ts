import { describe, expect, it } from "vitest";
import {
  ideaToRecipeInput,
  pantryIdeasSchema,
  pantryRequestSchema,
  parsePantryText,
} from "./schemas";

const idea = {
  title: "Egg fried rice",
  description: "Quick and filling.",
  prepMinutes: 5,
  cookMinutes: 10,
  servings: 2,
  difficulty: "EASY" as const,
  ingredients: [{ quantity: "2", unit: "", name: "eggs" }],
  steps: ["Scramble the eggs.", "Add rice."],
  usesFromPantry: ["eggs", "rice"],
  missing: ["soy sauce"],
};

describe("parsePantryText", () => {
  it("splits on commas, semicolons, and new lines, then normalizes and de-duplicates", () => {
    expect(parsePantryText("Eggs, rice\nSpinach; egg ,, ")).toEqual(["egg", "rice", "spinach"]);
  });

  it("caps the list at 30 items", () => {
    expect(
      parsePantryText(Array.from({ length: 40 }, (_, i) => `item${i}`).join(",")),
    ).toHaveLength(30);
  });
});

describe("pantryRequestSchema", () => {
  it("normalizes items and rejects an empty list", () => {
    expect(pantryRequestSchema.parse({ items: ["Tomatoes", "tomato"] }).items).toEqual(["tomato"]);
    expect(pantryRequestSchema.safeParse({ items: [] }).success).toBe(false);
    expect(pantryRequestSchema.safeParse({ items: ["!!!"] }).success).toBe(false);
  });
});

describe("pantryIdeasSchema", () => {
  it("accepts a well-formed idea", () => {
    expect(pantryIdeasSchema.safeParse({ ideas: [idea] }).success).toBe(true);
  });

  it("rejects out-of-range or malformed model output", () => {
    expect(pantryIdeasSchema.safeParse({ ideas: [] }).success).toBe(false);
    expect(pantryIdeasSchema.safeParse({ ideas: [idea, idea, idea, idea] }).success).toBe(false);
    expect(pantryIdeasSchema.safeParse({ ideas: [{ ...idea, servings: 0 }] }).success).toBe(false);
    expect(pantryIdeasSchema.safeParse({ ideas: [{ ...idea, cookMinutes: 2.5 }] }).success).toBe(
      false,
    );
    expect(pantryIdeasSchema.safeParse({ ideas: [{ ...idea, steps: [] }] }).success).toBe(false);
    expect(
      pantryIdeasSchema.safeParse({ ideas: [{ ...idea, title: "x".repeat(500) }] }).success,
    ).toBe(false);
  });
});

describe("ideaToRecipeInput", () => {
  it("maps an idea to recipe form values", () => {
    const input = ideaToRecipeInput(idea);
    expect(input.ingredients).toEqual([{ quantity: "2", unit: "", name: "eggs", note: "" }]);
    expect(input.steps).toEqual([{ text: "Scramble the eggs." }, { text: "Add rice." }]);
    expect(input.imageUrl).toBeNull();
  });
});
