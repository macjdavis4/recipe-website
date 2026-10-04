import { describe, expect, it } from "vitest";
import { isActive } from "./nav-links";

describe("isActive", () => {
  it("matches home only on the exact root path", () => {
    expect(isActive("/", "/")).toBe(true);
    expect(isActive("/recipes", "/")).toBe(false);
  });

  it("matches a section and its child routes", () => {
    expect(isActive("/recipes", "/recipes")).toBe(true);
    expect(isActive("/recipes/pancakes", "/recipes")).toBe(true);
  });

  it("does not match a different section that shares a prefix", () => {
    expect(isActive("/recipes-archive", "/recipes")).toBe(false);
  });
});
