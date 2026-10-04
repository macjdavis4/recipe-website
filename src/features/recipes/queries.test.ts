import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
const { buildRecipeWhere } = await import("./queries");

describe("buildRecipeWhere", () => {
  it("returns an empty filter when nothing is set", () => {
    expect(buildRecipeWhere({})).toEqual({});
  });

  it("searches text fields and normalized ingredient names", () => {
    const where = buildRecipeWhere({ q: "Tomatoes" });
    const or = (where.AND as { OR: object[] }[])[0].OR;
    expect(or).toContainEqual({ title: { contains: "Tomatoes", mode: "insensitive" } });
    expect(or).toContainEqual({
      ingredients: { some: { normalizedName: { contains: "tomato" } } },
    });
  });

  it("combines cuisine, difficulty, and tag filters", () => {
    expect(buildRecipeWhere({ cuisine: "Thai", difficulty: "EASY", tag: "vegan" })).toEqual({
      AND: [
        { cuisine: { equals: "Thai", mode: "insensitive" } },
        { difficulty: "EASY" },
        { tags: { some: { tag: { name: "vegan" } } } },
      ],
    });
  });
});
