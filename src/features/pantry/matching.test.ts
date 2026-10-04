import { describe, expect, it } from "vitest";
import { ingredientMatches, matchesAny, STAPLES } from "./matching";

describe("ingredientMatches", () => {
  it.each([
    ["red lentil", "lentil"],
    ["egg", "egg"],
    ["extra-virgin olive oil", "olive oil"],
    ["chicken thigh", "chicken"],
  ])("%s contains %s", (name, item) => expect(ingredientMatches(name, item)).toBe(true));

  it.each([
    ["boil", "oil"],
    ["eggplant", "egg"],
    ["rice vinegar", "vinegar rice"],
    ["pineapple", "apple"],
  ])("%s does not contain %s", (name, item) => expect(ingredientMatches(name, item)).toBe(false));
});

describe("matchesAny", () => {
  it("treats staples as available", () => {
    expect(matchesAny("salt", STAPLES)).toBe(true);
    expect(matchesAny("kosher salt", STAPLES)).toBe(true);
    expect(matchesAny("saffron", STAPLES)).toBe(false);
  });
});
