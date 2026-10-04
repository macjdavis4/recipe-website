import { describe, expect, it } from "vitest";
import { formatNumber, parseQuantity, scaleQuantity } from "./scaling";

describe("parseQuantity", () => {
  it.each([
    ["2", { min: 2 }],
    ["0.5", { min: 0.5 }],
    [".25", { min: 0.25 }],
    ["1/2", { min: 0.5 }],
    ["1 1/2", { min: 1.5 }],
    ["½", { min: 0.5 }],
    ["1½", { min: 1.5 }],
    ["2-3", { min: 2, max: 3 }],
    ["1 to 2", { min: 1, max: 2 }],
    ["1/2 – 1", { min: 0.5, max: 1 }],
  ])("%j", (raw, expected) => {
    expect(parseQuantity(raw)).toEqual(expected);
  });

  it.each(["a pinch", "to taste", "", "1/0", "0", "3-2", "1/2/3", "abc 2"])("rejects %j", (raw) => {
    expect(parseQuantity(raw)).toBeNull();
  });
});

describe("formatNumber", () => {
  it.each([
    [2, "2"],
    [0.5, "1/2"],
    [1.5, "1 1/2"],
    [1 / 3, "1/3"],
    [2 / 3 + 1, "1 2/3"],
    [0.125, "1/8"],
    [1.999, "2"],
    [0.3, "0.3"],
    [12.5, "12.5"],
    [250, "250"],
  ])("%d -> %j", (value, text) => {
    expect(formatNumber(value)).toBe(text);
  });
});

describe("scaleQuantity", () => {
  it("doubles and halves common quantities", () => {
    expect(scaleQuantity("1 1/2", 2)).toBe("3");
    expect(scaleQuantity("1/2", 0.5)).toBe("1/4");
    expect(scaleQuantity("3", 1 / 3)).toBe("1");
    expect(scaleQuantity("1", 4 / 6)).toBe("2/3");
  });

  it("scales ranges", () => {
    expect(scaleQuantity("2-3", 2)).toBe("4-6");
  });

  it("leaves unparseable or empty quantities alone", () => {
    expect(scaleQuantity("a pinch", 2)).toBe("a pinch");
    expect(scaleQuantity(null, 2)).toBeNull();
    expect(scaleQuantity("", 2)).toBe("");
  });

  it("returns the original text when the factor is 1", () => {
    expect(scaleQuantity("½", 1)).toBe("½");
  });
});
