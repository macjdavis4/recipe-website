import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const src = fileURLToPath(new URL("../..", import.meta.url));

// Modules that touch secrets or the AI SDK. `import "server-only"` makes the
// build fail if a client component ever imports them.
const serverModules = [
  ...readdirSync(path.join(src, "lib/ai"))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => `lib/ai/${f}`),
  "lib/env.ts",
  "lib/db.ts",
  "lib/auth.ts",
  "lib/storage/index.ts",
  "features/ai/rate-limit.ts",
];

describe("server-only guard", () => {
  it.each(serverModules)("%s imports server-only first", (file) => {
    const firstLine = readFileSync(path.join(src, file), "utf8").split("\n")[0];
    expect(firstLine).toBe('import "server-only";');
  });

  it("never exposes secrets through NEXT_PUBLIC_ variables", () => {
    const env = readFileSync(path.join(src, "lib/env.ts"), "utf8");
    expect(env).not.toMatch(/NEXT_PUBLIC_/);
  });
});
