import {
  createRecipeViaForm,
  createUser,
  expect,
  expectNoHorizontalScroll,
  login,
  test,
} from "./fixtures";

test("sign up, then land where you were going", async ({ page }) => {
  await page.goto("/recipes/new");
  await page.getByRole("link", { name: "Create an account" }).click();
  await page.getByLabel("Name").fill("New Cook");
  await page.getByLabel("Email").fill(`new-${crypto.randomUUID().slice(0, 8)}@example.com`);
  await page.getByLabel("Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/recipes\/new$/);
  await expect(page.getByRole("heading", { name: "Share a recipe" })).toBeVisible();
});

test("wrong password shows one generic error", async ({ page }) => {
  const user = await createUser("Wrong Password");
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill("not the password");
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page.locator("[data-slot=alert]")).toHaveText("Email or password is incorrect.");
});

test("create, edit, and delete a recipe", async ({ page }) => {
  const user = await createUser("Crud Cook");
  await login(page, user);

  // Validation errors on an empty form
  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Share recipe" }).click();
  await expect(page.getByText("Use at least 3 characters")).toBeVisible();
  await expectNoHorizontalScroll(page);

  const slug = await createRecipeViaForm(page, "Playwright Porridge", ["rolled oats", "milk"]);
  await expect(page.getByRole("heading", { name: "Playwright Porridge", level: 1 })).toBeVisible();
  await expect(page.getByText("rolled oats")).toBeVisible();

  // Edit keeps the slug
  await page.getByRole("link", { name: "Edit" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByLabel("Title")).toHaveValue("Playwright Porridge");
  await page.getByLabel("Title").fill("Playwright Porridge, Improved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(`/recipes/${slug}`);
  await expect(
    page.getByRole("heading", { name: "Playwright Porridge, Improved", level: 1 }),
  ).toBeVisible();

  // Delete after confirming
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete recipe" }).click();
  await expect(page).toHaveURL(`/u/${user.id}`);
  const response = await page.goto(`/recipes/${slug}`);
  expect(response?.status()).toBe(404);
});

test("unsaved form changes are restored as a draft", async ({ page }) => {
  await login(page, await createUser("Draft Cook"));
  await page.goto("/recipes/new");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Title").fill("Half finished stew");
  await page.waitForTimeout(600); // drafts save after a short pause
  await page.reload();
  await expect(page.getByText("We restored your unsaved changes.")).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue("Half finished stew");
  await page.getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByLabel("Title")).toHaveValue("");
});
