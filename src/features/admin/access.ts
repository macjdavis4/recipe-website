import "server-only";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { ForbiddenError } from "@/lib/errors";

export type Admin = { id: string; email: string };

/** ADMIN_EMAILS as a normalized list. */
export function parseAdminEmails(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return Boolean(email) && parseAdminEmails(getEnv().ADMIN_EMAILS).includes(email!.toLowerCase());
}

/**
 * The signed-in admin, or null. Checked against the database, not the session:
 * the account's current email must be in ADMIN_EMAILS and verified (proven by
 * a completed password reset), so nobody can claim an admin email by signing
 * up with it first.
 */
export async function getAdmin(): Promise<Admin | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, email: true, emailVerified: true },
  });
  if (!user?.emailVerified || !isAdminEmail(user.email)) return null;
  return { id: user.id, email: user.email };
}

/** For admin pages: everyone else gets a plain 404, so the area stays hidden. */
export async function requireAdminPage(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) notFound();
  return admin;
}

/** For admin actions. Each one checks again on the server. */
export async function assertAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new ForbiddenError();
  return admin;
}
