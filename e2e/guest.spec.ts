import { expect, expectNoHorizontalScroll, test } from "./fixtures";

test.describe("guests can read everything", () => {
  test("home page links into the recipe list", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Cook what you love");
    await expectNoHorizontalScroll(page);
    await page.getByRole("link", { name: "Browse recipes" }).click();
    await expect(page).toHaveURL(/\/recipes$/);
    await expect(page.getByRole("heading", { name: "Recipes", level: 1 })).toBeVisible();
  });

  test("search and filters narrow the list", async ({ page }) => {
    await page.goto("/recipes");
    await expectNoHorizontalScroll(page);
    await expect(page.getByRole("link", { name: "Weeknight Red Lentil Dal" })).toBeVisible();

    await page.getByLabel("Search recipes").fill("lentils");
    await page.getByRole("button", { name: "Show recipes" }).click();
    await expect(page.getByRole("link", { name: "Weeknight Red Lentil Dal" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Classic Buttermilk Pancakes" })).toHaveCount(0);

    await page.goto("/recipes?cuisine=Italian");
    await expect(page.locator("article h3")).toHaveText(
      ["Roasted Tomato Basil Soup", "Garlic Butter Shrimp Pasta"],
      { useInnerText: true },
    );
    await expect(page.locator("article")).toHaveCount(2);

    await page.goto("/recipes?q=nothing-matches-this");
    await expect(page.getByRole("heading", { name: "No recipes match" })).toBeVisible();
  });

  test("recipe detail scales servings and hides owner controls", async ({ page }) => {
    await page.goto("/recipes/weeknight-red-lentil-dal");
    await expectNoHorizontalScroll(page);
    await expect(
      page.getByRole("heading", { name: "Weeknight Red Lentil Dal", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("1 1/2 cups red lentils, rinsed")).toBeVisible();

    for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "More servings" }).click();
    await expect(page.getByText("8 servings")).toBeVisible();
    await expect(page.getByText("3 cups red lentils, rinsed")).toBeVisible();

    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Log in to ask the assistant" })).toBeVisible();
  });

  test("profile pages are public", async ({ page }) => {
    await page.goto("/recipes/weeknight-red-lentil-dal");
    await page.getByRole("link", { name: "Maya Patel" }).click();
    await expect(page.getByRole("heading", { name: "Maya Patel", level: 1 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Lemony Chickpea Salad" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("pantry matches community recipes without logging in", async ({ page }) => {
    await page.goto("/pantry");
    await page
      .getByLabel("What do you have?")
      .fill("eggs, cooked rice, scallions, soy sauce, frozen peas");
    await page.getByRole("button", { name: "Find recipes" }).click();
    const first = page.locator("#matches-title ~ ul > li").first();
    await expect(first.getByRole("heading")).toHaveText("Egg Fried Rice");
    await expect(first.getByText(/You have \d of 7 ingredients/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Log in to get AI recipe ideas" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test("protected pages send guests to login and back", async ({ page }) => {
    await page.goto("/recipes/new");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Frecipes%2Fnew/);
    await page.goto("/assistant");
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fassistant/);
  });

  test("the footer links to the privacy page", async ({ page }) => {
    await page.goto("/");
    await page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link", { name: "Privacy" })
      .click();
    await expect(page.getByRole("heading", { name: "Privacy", level: 1 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Deleting your account" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
