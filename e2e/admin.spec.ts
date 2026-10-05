import bcrypt from "bcrypt";
import {
  createUser,
  db,
  expect,
  expectNoHorizontalScroll,
  login,
  test,
  type TestUser,
} from "./fixtures";

const PASSWORD = "correct horse battery";

/** The admin for this project (see ADMIN_EMAILS in playwright.config.ts). */
async function adminUser(project: string, verified = true): Promise<TestUser> {
  const email = `admin-${project}@example.com`;
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const emailVerified = verified ? new Date() : null;
  const user = await db.user.upsert({
    where: { email },
    update: { passwordHash, emailVerified },
    create: { name: `Admin ${project}`, email, passwordHash, emailVerified },
  });
  return { id: user.id, name: user.name!, email, password: PASSWORD };
}

test("guests are sent to log in, and other cooks get a 404", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fadmin/);

  await login(page, await createUser("Curious Cook"));
  const res = await page.goto("/admin");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "We could not find that page" })).toBeVisible();
});

test("an admin email that was never verified gets a 404 too", async ({ page }, info) => {
  await login(page, await adminUser(info.project.name, false));
  expect((await page.goto("/admin"))?.status()).toBe(404);
});

test("the admin can find and delete another cook's recipe and account", async ({ page }, info) => {
  const admin = await adminUser(info.project.name);
  const cook = await createUser("Spammy Cook");
  const recipe = await db.recipe.create({
    data: {
      slug: `spam-${crypto.randomUUID().slice(0, 8)}`,
      title: `Spam Casserole ${crypto.randomUUID().slice(0, 6)}`,
      description: "Not really a recipe.",
      prepMinutes: 1,
      cookMinutes: 1,
      servings: 1,
      difficulty: "EASY",
      authorId: cook.id,
    },
  });

  await login(page, admin);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Admin" }).click();
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible();
  await expect(page.getByText("Accounts", { exact: true }).first()).toBeVisible();
  await expectNoHorizontalScroll(page);

  // Delete the recipe.
  await page.getByLabel("Search recipes by title").fill(recipe.title);
  await page.getByLabel("Search recipes by title").press("Enter");
  await page.getByRole("button", { name: `Delete recipe: ${recipe.title}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete recipe" }).click();
  await expect(page.getByText("Recipe deleted.")).toBeVisible();
  expect(await db.recipe.findUnique({ where: { id: recipe.id } })).toBeNull();

  // Delete the account.
  await page.getByLabel("Search by name or email").fill(cook.email);
  await page.getByLabel("Search by name or email").press("Enter");
  await page.getByRole("button", { name: `Delete account: ${cook.name}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByText("Account deleted.")).toBeVisible();
  expect(await db.user.findUnique({ where: { id: cook.id } })).toBeNull();

  // The admin can't delete themselves from here.
  await page.getByLabel("Search by name or email").fill(admin.email);
  await page.getByLabel("Search by name or email").press("Enter");
  await expect(page.getByText("This is you")).toBeVisible();
});
