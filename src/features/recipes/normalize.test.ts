import { describe, expect, it } from "vitest";
import { normalizeIngredientName, singularize } from "./normalize";

describe("singularize", () => {
  it.each([
    ["eggs", "egg"],
    ["onions", "onion"],
    ["berries", "berry"],
    ["tomatoes", "tomato"],
    ["potatoes", "potato"],
    ["peaches", "peach"],
    ["radishes", "radish"],
    ["glasses", "glass"],
    ["cheeses", "cheese"],
    ["olives", "olive"],
    ["cloves", "clove"],
    ["leaves", "leaf"],
    ["cookies", "cookie"],
    ["anchovies", "anchovy"],
  ])("%s -> %s", (plural, single) => {
    expect(singularize(plural)).toBe(single);
  });

  it.each(["hummus", "asparagus", "couscous", "molasses", "egg", "rice", "flour", "bass", "pea"])(
    "leaves %s alone",
    (word) => expect(singularize(word)).toBe(word),
  );
});

describe("normalizeIngredientName", () => {
  it("lowercases, trims, strips punctuation and accents, and singularizes each word", () => {
    expect(normalizeIngredientName("  Cherry Tomatoes ")).toBe("cherry tomato");
    expect(normalizeIngredientName("Jalapeños")).toBe("jalapeno");
    expect(normalizeIngredientName("Eggs, beaten")).toBe("egg beaten");
    expect(normalizeIngredientName("extra-virgin olive oil")).toBe("extra-virgin olive oil");
    expect(normalizeIngredientName("Brussels Sprouts")).toBe("brussels sprout");
  });

  it("matches singular and plural forms", () => {
    expect(normalizeIngredientName("Carrots")).toBe(normalizeIngredientName("carrot"));
  });

  it("returns an empty string for blank input", () => {
    expect(normalizeIngredientName("  !! ")).toBe("");
  });
});
