import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./callback-url";

describe("safeCallbackUrl", () => {
  it.each(["/", "/recipes/new", "/recipes?q=soup&page=2", "/assistant#chat"])("keeps %s", (url) => {
    expect(safeCallbackUrl(url)).toBe(url);
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "recipes",
    "/\tevil",
    "",
  ])("rejects %j", (url) => {
    expect(safeCallbackUrl(url)).toBe("/");
  });

  it("rejects non-strings and very long values", () => {
    expect(safeCallbackUrl(undefined)).toBe("/");
    expect(safeCallbackUrl(["/a"])).toBe("/");
    expect(safeCallbackUrl(`/${"a".repeat(3000)}`)).toBe("/");
  });
});
