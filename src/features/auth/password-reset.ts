import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { getEmailSender } from "@/lib/email";
import { getEnv } from "@/lib/env";
import { SITE_NAME } from "@/lib/site";
import { clearLoginFailures } from "./login-rate-limit";
import { hashPassword } from "./password";

export const RESET_TTL_MS = 60 * 60 * 1000;

/** Only this hash is stored. The raw token exists only in the emailed link. */
export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Always the configured site URL, never the request's Host header: a forged
// Host would otherwise put an attacker's domain in the emailed link.
function siteUrl(): string {
  return (getEnv().AUTH_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function resetEmail(link: string, name: string | null) {
  const greeting = name ? `Hi ${name},` : "Hi,";
  const subject = `Reset your ${SITE_NAME} password`;
  const text = [
    greeting,
    "",
    `Someone asked to reset the password for your ${SITE_NAME} account.`,
    "Use this link within 1 hour to choose a new password:",
    "",
    link,
    "",
    "If this wasn't you, ignore this email. Your password stays the same.",
  ].join("\n");
  const html = `<p>${escapeHtml(greeting)}</p>
<p>Someone asked to reset the password for your ${escapeHtml(SITE_NAME)} account.
Use this link within 1 hour to choose a new password:</p>
<p><a href="${escapeHtml(link)}">Choose a new password</a></p>
<p>If this wasn't you, ignore this email. Your password stays the same.</p>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

/**
 * Emails a one-hour reset link to the account with this email. Does nothing
 * when there is no such account or email is off; callers show the same
 * message either way.
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  const sender = getEmailSender();
  if (!sender) return;
  const user = await db.user.findUnique({ where: { email }, select: { id: true, name: true } });
  if (!user) return;

  const token = randomBytes(32).toString("base64url");
  await db.$transaction([
    // One live link per account, and expired links from anyone are cleared.
    db.passwordResetToken.deleteMany({
      where: { OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }] },
    }),
    db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashResetToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    }),
  ]);

  const link = `${siteUrl()}/reset-password?token=${token}`;
  await sender.send({ to: email, ...resetEmail(link, user.name) });
}

/** Sets a new password if the token is valid and unused. Each token works once. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  const row = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashResetToken(token) },
    select: { id: true, userId: true, expiresAt: true, user: { select: { email: true } } },
  });
  if (!row || row.expiresAt < new Date()) return false;

  // Claim the token first; a second request with the same link deletes nothing.
  const claimed = await db.passwordResetToken.deleteMany({ where: { id: row.id } });
  if (claimed.count === 0) return false;

  await db.$transaction([
    db.user.update({
      where: { id: row.userId },
      data: { passwordHash: await hashPassword(password), passwordChangedAt: new Date() },
    }),
    db.passwordResetToken.deleteMany({ where: { userId: row.userId } }),
  ]);
  await clearLoginFailures(row.user.email);
  return true;
}
