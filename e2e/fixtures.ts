import { expect, test as base, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { TEST_DATABASE_URL } from "./env";

export const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });

export type TestUser = { id: string; name: string; email: string; password: string };

/** Creates a fresh user directly in larder_test (fast), unique per test. */
export async function createUser(name = "Test Cook"): Promise<TestUser> {
  const email = `${name.toLowerCase().replace(/\W+/g, "-")}-${crypto.randomUUID().slice(0, 8)}@example.com`;
  const password = "correct horse battery";
  const user = await db.user.create({
    data: { name, email, passwordHash: await bcrypt.hash(password, 4) },
  });
  return { id: user.id, name, email, password };
}

/** Logs in through the real form. */
export async function login(page: Page, user: TestUser, callbackUrl = "/") {
  await page.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible();
}

/** Every page must work at its viewport width without sideways scrolling (CLAUDE.md rule 7). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "page scrolls horizontally").toBeLessThanOrEqual(0);
}

/** Creates a recipe through the form and returns its slug. */
export async function createRecipeViaForm(page: Page, title: string, ingredients = ["water"]) {
  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Description").fill(`${title} for testing.`);
  for (const [i, name] of ingredients.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Add ingredient" }).click();
    await page.getByLabel("Ingredient", { exact: true }).nth(i).fill(name);
  }
  await page.getByLabel("Step 1 instructions").fill("Combine and cook.");
  await page.getByRole("button", { name: "Share recipe" }).click();
  await page.waitForURL(/\/recipes\/(?!new)[^/]+$/);
  return new URL(page.url()).pathname.split("/")[2];
}

export const test = base;
export { expect };
