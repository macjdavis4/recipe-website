import { AI_LIMIT } from "./env";
import { createUser, db, expect, expectNoHorizontalScroll, login, test } from "./fixtures";

// The server runs with AI_PROVIDER=mock, so no real AI API is ever called.

test("the assistant streams a sanitized answer", async ({ page }) => {
  await login(page, await createUser("Chat Cook"));
  await page.goto("/assistant");
  await page
    .getByLabel("Your question")
    .fill('<img src=x onerror="alert(1)"> How long do I rest a steak?');
  await page.getByRole("button", { name: "Ask" }).click();

  const conversation = page.getByRole("list", { name: "Conversation" });
  await expect(conversation.locator("strong")).toHaveText("Mock answer.");
  await expect(conversation.getByText(/How long do I rest a steak/).last()).toBeVisible();
  await expect(conversation.locator("img")).toHaveCount(0);
  await expectNoHorizontalScroll(page);
});

test("ask about a recipe from its page", async ({ page }) => {
  await login(page, await createUser("Recipe Asker"));
  await page.goto("/recipes/egg-fried-rice");
  await page.getByRole("button", { name: "Can I make this ahead?" }).click();
  await expect(page.getByRole("list", { name: "Conversation" }).locator("strong")).toHaveText(
    "Mock answer.",
  );
});

test("the hourly AI limit returns a friendly 429", async ({ page }) => {
  const user = await createUser("Busy Cook");
  await db.aiUsage.createMany({
    data: Array.from({ length: AI_LIMIT }, () => ({ userId: user.id, kind: "CHAT" as const })),
  });
  await login(page, user);
  await page.goto("/assistant");
  await page.getByLabel("Your question").fill("One more question?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator("[data-slot=alert]")).toContainText(
    "You have reached the hourly limit",
  );
  // The question goes back in the box so it is not lost.
  await expect(page.getByLabel("Your question")).toHaveValue("One more question?");

  const res = await page.request.post("/api/ai/chat", {
    data: { messages: [{ role: "user", content: "hi" }] },
  });
  expect(res.status()).toBe(429);
  expect(Number(res.headers()["retry-after"])).toBeGreaterThan(0);
});

test("pantry AI ideas can be saved as a recipe draft", async ({ page }) => {
  await login(page, await createUser("Pantry Cook"));
  await page.goto("/pantry?have=eggs%2C+rice&staples=1");
  await page.getByRole("button", { name: "Suggest recipes with AI" }).click();
  const ideas = page.getByRole("list", { name: "AI recipe ideas" });
  await expect(ideas.getByRole("heading")).toHaveText(["Simple egg skillet"]);
  await expectNoHorizontalScroll(page);

  await ideas.getByRole("button", { name: "Save as my recipe" }).click();
  await expect(page).toHaveURL(/\/recipes\/new$/);
  await expect(page.getByLabel("Title")).toHaveValue("Simple egg skillet");
});

test("AI endpoints reject guests", async ({ request }) => {
  expect(
    (
      await request.post("/api/ai/chat", { data: { messages: [{ role: "user", content: "hi" }] } })
    ).status(),
  ).toBe(401);
  expect((await request.post("/api/ai/pantry", { data: { items: ["egg"] } })).status()).toBe(401);
});
