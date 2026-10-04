import "server-only";
import { CredentialsSignin } from "next-auth";
import { db } from "@/lib/db";
import { clearLoginFailures, isLoginBlocked, recordLoginFailure } from "./login-rate-limit";
import { verifyPassword } from "./password";
import { loginSchema } from "./schemas";

export class LoginRateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

export type AuthenticatedUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

/**
 * Checks an email and password. Returns null for every kind of mismatch so the
 * caller can show one generic error, and throws only when rate limited.
 */
export async function verifyCredentials(
  raw: unknown,
  ip: string | null,
): Promise<AuthenticatedUser | null> {
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { email, password } = parsed.data;

  if (await isLoginBlocked(email, ip)) throw new LoginRateLimitedError();

  const user = await db.user.findUnique({ where: { email } });
  // Always run bcrypt, even with no user, so timing does not reveal accounts.
  const valid = await verifyPassword(password, user?.passwordHash);

  if (!user?.passwordHash || !valid) {
    await recordLoginFailure(email, ip);
    return null;
  }

  await clearLoginFailures(email);
  return { id: user.id, name: user.name, email: user.email, image: user.image };
}
