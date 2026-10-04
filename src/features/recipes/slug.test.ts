import { describe, expect, it } from "vitest";
import { slugify, uniqueSlug } from "./slug";

describe("slugify", () => {
  it.each([
    ["Crème Brûlée (Easy!)", "creme-brulee-easy"],
    ["  Mac & Cheese  ", "mac-and-cheese"],
    ["Grandma's 3-Bean Chili", "grandma-s-3-bean-chili"],
    ["!!!", "recipe"],
    ["日本の料理", "recipe"],
  ])("%j -> %j", (title, slug) => {
    expect(slugify(title)).toBe(slug);
  });

  it("caps length without leaving a trailing dash", () => {
    const slug = slugify(`${"a".repeat(59)} b`);
    expect(slug.length).toBeLessThanOrEqual(60);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("adds the first free numeric suffix", async () => {
    const taken = new Set(["soup", "soup-2"]);
    expect(await uniqueSlug("Soup", async (s) => taken.has(s))).toBe("soup-3");
    expect(await uniqueSlug("Stew", async (s) => taken.has(s))).toBe("stew");
  });

  it("never returns a reserved route name", async () => {
    expect(await uniqueSlug("New!", async () => false)).toBe("new-2");
  });
});
