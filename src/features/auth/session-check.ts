import "server-only";
import type { JWT } from "next-auth/jwt";
import { db } from "@/lib/db";

/** True when the session signed in before the password was last changed. */
export function startedBeforePasswordChange(
  authAt: number | undefined,
  passwordChangedAt: Date | null,
): boolean {
  if (!passwordChangedAt) return false;
  // Sessions from before authAt existed count as old.
  return (authAt ?? 0) < passwordChangedAt.getTime();
}

/** False when the user is gone or reset their password after this session began. */
export async function isSessionCurrent(token: JWT): Promise<boolean> {
  if (!token.sub) return true;
  const user = await db.user.findUnique({
    where: { id: token.sub },
    select: { passwordChangedAt: true },
  });
  // authAt is our own claim, set in auth.config.ts when the session signs in.
  const authAt = typeof token.authAt === "number" ? token.authAt : undefined;
  return user !== null && !startedBeforePasswordChange(authAt, user.passwordChangedAt);
}
