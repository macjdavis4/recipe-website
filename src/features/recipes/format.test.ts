import { describe, expect, it } from "vitest";
import { formatMinutes, ingredientLine } from "./format";

describe("formatMinutes", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [60, "1 hr"],
    [135, "2 hr 15 min"],
  ])("%d -> %s", (minutes, text) => expect(formatMinutes(minutes)).toBe(text));
});

describe("ingredientLine", () => {
  it("joins the parts that are present", () => {
    expect(ingredientLine({ quantity: "1 1/2", unit: "cups", name: "flour", note: "sifted" })).toBe(
      "1 1/2 cups flour, sifted",
    );
    expect(ingredientLine({ quantity: null, unit: "", name: "salt", note: null })).toBe("salt");
  });
});
