// Shared settings for the end-to-end run. Plain values only: imported by the
// Playwright config, global setup, and tests.

try {
  // Local runs reuse .env for database credentials. CI sets env vars instead.
  process.loadEnvFile(".env");
} catch {}

export const PORT = Number(process.env.E2E_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;

/** Always a separate database: DATABASE_URL with the name swapped to larder_test. */
export const TEST_DATABASE_URL =
  process.env.E2E_DATABASE_URL ??
  (process.env.DATABASE_URL ?? "postgresql://larder:larder@localhost:5432/larder").replace(
    /\/[^/?]+(\?|$)/,
    "/larder_test$1",
  );

export const SEED_PASSWORD = "cookbook-demo";
export const AI_LIMIT = 5;
