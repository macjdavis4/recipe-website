import "server-only";
import { db } from "@/lib/db";

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_IP = 20;
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export const MAX_SIGNUPS_PER_IP = 10;
// Rows older than this are pruned. Longer than every window above.
const RETENTION_MS = 24 * 60 * 60 * 1000;

export const keys = {
  email: (email: string) => `login:email:${email}`,
  ip: (ip: string) => `login:ip:${ip}`,
  signupIp: (ip: string) => `signup:ip:${ip}`,
};

async function countSince(key: string, windowMs: number): Promise<number> {
  return db.loginAttempt.count({
    where: { key, createdAt: { gte: new Date(Date.now() - windowMs) } },
  });
}

async function record(keysToRecord: string[]): Promise<void> {
  await db.$transaction([
    db.loginAttempt.createMany({ data: keysToRecord.map((key) => ({ key })) }),
    db.loginAttempt.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } },
    }),
  ]);
}

/** True when this email or IP has too many recent failed logins. */
export async function isLoginBlocked(email: string, ip: string | null): Promise<boolean> {
  const [byEmail, byIp] = await Promise.all([
    countSince(keys.email(email), LOGIN_WINDOW_MS),
    ip ? countSince(keys.ip(ip), LOGIN_WINDOW_MS) : Promise.resolve(0),
  ]);
  return byEmail >= MAX_FAILURES_PER_EMAIL || byIp >= MAX_FAILURES_PER_IP;
}

export async function recordLoginFailure(email: string, ip: string | null): Promise<void> {
  await record(ip ? [keys.email(email), keys.ip(ip)] : [keys.email(email)]);
}

/** A successful login clears that email's failures (not the IP's). */
export async function clearLoginFailures(email: string): Promise<void> {
  await db.loginAttempt.deleteMany({ where: { key: keys.email(email) } });
}

/** Records the signup attempt and returns false when the IP is over its limit. */
export async function allowSignup(ip: string | null): Promise<boolean> {
  if (!ip) return true;
  if ((await countSince(keys.signupIp(ip), SIGNUP_WINDOW_MS)) >= MAX_SIGNUPS_PER_IP) return false;
  await record([keys.signupIp(ip)]);
  return true;
}
