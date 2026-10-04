import "server-only";
import type { AiUsageKind } from "@prisma/client";
import { db } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { HttpError } from "@/lib/errors";

const WINDOW_MS = 60 * 60 * 1000;

export class AiRateLimitError extends HttpError {
  constructor(readonly retryAfterSeconds: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
      429,
      `You have reached the hourly limit for the assistant. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`,
    );
  }
}

/** Throws AiRateLimitError (429) when the user has used up this hour's AI requests. */
export async function assertWithinAiLimit(userId: string): Promise<void> {
  const limit = getEnv().AI_RATE_LIMIT_PER_HOUR;
  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await db.aiUsage.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  if (recent.length < limit) return;
  // The window frees up when the oldest counted request ages out.
  const oldest = recent[recent.length - limit].createdAt.getTime();
  throw new AiRateLimitError(Math.max(1, Math.ceil((oldest + WINDOW_MS - Date.now()) / 1000)));
}

export async function recordAiUsage(userId: string, kind: AiUsageKind): Promise<void> {
  await db.aiUsage.create({ data: { userId, kind } });
}
