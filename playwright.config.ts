import { defineConfig, devices } from "@playwright/test";
import { AI_LIMIT, BASE_URL, PORT, SEED_PASSWORD, TEST_DATABASE_URL } from "./e2e/env";

// Use a preinstalled Chromium when the bundled one is not available
// (for example in sandboxes where `playwright install` cannot download).
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 45_000,
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    launchOptions: { executablePath },
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile-390",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // A production build against the larder_test database, with the mock AI.
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_URL: BASE_URL,
      AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-0123456789",
      AI_PROVIDER: "mock",
      AI_RATE_LIMIT_PER_HOUR: String(AI_LIMIT),
      STORAGE_DRIVER: "local",
      SEED_PASSWORD,
    },
  },
});
