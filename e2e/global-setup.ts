import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { SEED_PASSWORD, TEST_DATABASE_URL } from "./env";

/** Migrates and empties larder_test, then loads the demo seed. Never touches the dev database. */
export default async function globalSetup() {
  if (!/\/larder_test(\?|$)/.test(TEST_DATABASE_URL)) {
    throw new Error("Refusing to run e2e against a database not named larder_test.");
  }
  const env = { ...process.env, DATABASE_URL: TEST_DATABASE_URL, SEED_PASSWORD };
  execSync("pnpm exec prisma migrate deploy", { env, stdio: "inherit" });

  const db = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  // TRUNCATE (not drop) so a server that is already running keeps working.
  await db.$executeRawUnsafe(
    'TRUNCATE "User", "Account", "VerificationToken", "Recipe", "Tag", "LoginAttempt", "AiUsage", "PasswordResetToken" CASCADE',
  );
  await db.$disconnect();

  execSync("pnpm exec tsx prisma/seed.ts", { env, stdio: "inherit" });
}
