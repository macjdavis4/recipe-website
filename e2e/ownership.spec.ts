import type { Request } from "@playwright/test";
import { createRecipeViaForm, createUser, db, expect, login, test } from "./fixtures";

test("another user's edit page answers 403 and hides owner controls", async ({ browser }) => {
  const owner = await browser.newPage();
  await login(owner, await createUser("Owner"));
  const slug = await createRecipeViaForm(owner, "Owner Only Omelet", ["eggs"]);

  const intruder = await browser.newPage();
  await login(intruder, await createUser("Intruder"));
  const response = await intruder.goto(`/recipes/${slug}/edit`);
  expect(response?.status()).toBe(403);
  await expect(
    intruder.getByRole("heading", { name: "You cannot edit this recipe" }),
  ).toBeVisible();

  await intruder.goto(`/recipes/${slug}`);
  await expect(intruder.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(intruder.getByRole("button", { name: "Delete" })).toHaveCount(0);
});

test("calling the delete server action directly as another user returns 403", async ({
  browser,
}) => {
  const owner = await browser.newPage();
  await login(owner, await createUser("Action Owner"));
  const slug = await createRecipeViaForm(owner, "Server Checked Stew", ["beans"]);

  // Capture the real delete action request from the owner's page, then block it.
  let captured: Request | undefined;
  await owner.route(`**/recipes/${slug}`, async (route) => {
    if (route.request().method() === "POST" && route.request().headers()["next-action"]) {
      captured = route.request();
      return route.abort();
    }
    return route.continue();
  });
  await owner.getByRole("button", { name: "Delete" }).click();
  await owner.getByRole("button", { name: "Delete recipe" }).click();
  await expect.poll(() => captured).toBeTruthy();

  const replay = async (page: { request: import("@playwright/test").APIRequestContext }) => {
    const headers = { ...captured!.headers() };
    delete headers.cookie;
    const res = await page.request.post(captured!.url(), {
      headers,
      data: captured!.postData() ?? "",
    });
    return { status: res.status(), body: await res.text() };
  };

  // Same request, sent with another user's session cookie.
  const intruder = await browser.newPage();
  await login(intruder, await createUser("Action Intruder"));
  const asIntruder = await replay(intruder);
  expect(asIntruder.body).toContain('"status":403');

  // And with no session at all.
  const guest = await (await browser.newContext()).newPage();
  const asGuest = await replay(guest);
  expect(asGuest.body).toContain('"status":401');

  // The recipe is untouched.
  expect(await db.recipe.count({ where: { slug } })).toBe(1);
  expect((await intruder.goto(`/recipes/${slug}`))?.status()).toBe(200);
});
