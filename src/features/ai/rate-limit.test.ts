import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ findMany: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: { aiUsage: { findMany: m.findMany, create: m.create } } }));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ AI_RATE_LIMIT_PER_HOUR: 3 }) }));

const { AiRateLimitError, assertWithinAiLimit, recordAiUsage } = await import("./rate-limit");

const minutesAgo = (n: number) => ({ createdAt: new Date(Date.now() - n * 60_000) });

beforeEach(() => vi.resetAllMocks());

describe("assertWithinAiLimit", () => {
  it("allows requests under the hourly limit", async () => {
    m.findMany.mockResolvedValue([minutesAgo(50), minutesAgo(10)]);
    await expect(assertWithinAiLimit("u1")).resolves.toBeUndefined();
    expect(m.findMany.mock.calls[0][0].where.userId).toBe("u1");
  });

  it("throws a 429 with a retry time once the limit is reached", async () => {
    m.findMany.mockResolvedValue([minutesAgo(50), minutesAgo(30), minutesAgo(5)]);
    const error = await assertWithinAiLimit("u1").catch((e) => e);
    expect(error).toBeInstanceOf(AiRateLimitError);
    expect(error.status).toBe(429);
    // The 50-minute-old request frees up in about 10 minutes.
    expect(error.retryAfterSeconds).toBeGreaterThan(9 * 60);
    expect(error.retryAfterSeconds).toBeLessThanOrEqual(10 * 60);
    expect(error.message).toMatch(/Try again in 10 minutes/);
  });
});

describe("recordAiUsage", () => {
  it("stores one row per request with its kind", async () => {
    await recordAiUsage("u1", "PANTRY");
    expect(m.create).toHaveBeenCalledWith({ data: { userId: "u1", kind: "PANTRY" } });
  });
});
