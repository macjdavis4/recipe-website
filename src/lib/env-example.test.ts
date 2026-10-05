import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

// A fresh `cp .env.example .env` must pass validation, so new contributors
// are not blocked before their first page load.
describe(".env.example", () => {
  const values = Object.fromEntries(
    [...readFileSync(".env.example", "utf8").matchAll(/^([A-Z_]+)=("?)(.*?)\2(?:\s+#.*)?$/gm)].map(
      ([, key, , value]) => [key, value],
    ),
  );

  it("passes env validation in development as written", () => {
    expect(() => parseEnv({ ...values, NODE_ENV: "development" })).not.toThrow();
  });

  it("documents every variable the app validates", () => {
    const schema = readFileSync("src/lib/env.ts", "utf8");
    const validated = [...schema.matchAll(/^\s{4}([A-Z_]+):/gm)]
      .map((m) => m[1])
      .filter((k) => k !== "NODE_ENV");
    for (const key of validated) expect(Object.keys(values), key).toContain(key);
  });
});
