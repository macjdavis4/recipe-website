import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig uses jsx: "preserve" for Next.js; tests compile JSX themselves.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside a React Server Components build; tests run in plain Node.
      "server-only": fileURLToPath(new URL("./src/test/empty-module.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "prisma/**/*.test.ts",
      "deploy/**/*.test.ts",
    ],
    env: { NODE_ENV: "test" },
    // next-auth imports "next/server" without an extension, which plain Node ESM rejects.
    server: { deps: { inline: ["next-auth"] } },
  },
});
