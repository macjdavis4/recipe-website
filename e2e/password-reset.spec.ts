import { createHash, randomBytes } from "node:crypto";
import { createUser, db, expect, expectNoHorizontalScroll, login, test } from "./fixtures";

/** Stores a reset link the way the app does (hash only) and returns its URL. */
async function resetLinkFor(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await db.passwordResetToken.create({
    data: {
      userId,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });
  return `/reset-password?token=${token}`;
}

test("the login page links to password reset, which answers the same for any email", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expectNoHorizontalScroll(page);

  await page.getByLabel("Email").fill(`nobody-${crypto.randomUUID().slice(0, 8)}@example.com`);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account uses that email");
});

test("a reset link sets a new password, works once, and signs out old sessions", async ({
  page,
  browser,
}) => {
  const user = await createUser("Reset Cook");
  await login(page, user);

  const other = await browser.newContext();
  const resetPage = await other.newPage();
  const link = await resetLinkFor(user.id);
  await resetPage.goto(link);
  await resetPage.getByLabel("New password", { exact: true }).fill("a brand new password");
  await resetPage.getByLabel("Confirm new password").fill("a brand new password");
  await resetPage.getByRole("button", { name: "Save new password" }).click();
  await expect(resetPage).toHaveURL(/\/login\?reset=1$/);
  await expect(resetPage.getByRole("status")).toContainText("Password updated");

  // The new password works and the old one doesn't.
  await login(resetPage, { ...user, password: "a brand new password" });

  // The first browser's session started before the reset, so it is signed out.
  await page.goto("/recipes/new");
  await expect(page).toHaveURL(/\/login\?callbackUrl=/);
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible();

  // The link only works once.
  await resetPage.goto(link);
  await resetPage.getByLabel("New password", { exact: true }).fill("yet another password");
  await resetPage.getByLabel("Confirm new password").fill("yet another password");
  await resetPage.getByRole("button", { name: "Save new password" }).click();
  await expect(
    resetPage.getByText("This reset link has expired or was already used"),
  ).toBeVisible();
  await other.close();
});
