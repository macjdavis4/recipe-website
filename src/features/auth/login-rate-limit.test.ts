import { beforeEach, describe, expect, it, vi } from "vitest";
import { createFakeDb } from "./test-db";

const fake = vi.hoisted(() => ({
  current: undefined as unknown as ReturnType<typeof createFakeDb>,
}));
vi.mock("@/lib/db", () => ({
  get db() {
    return fake.current.db;
  },
}));

const { allowSignup, recordLoginFailure, MAX_SIGNUPS_PER_IP } = await import("./login-rate-limit");

beforeEach(() => {
  fake.current = createFakeDb();
});

describe("allowSignup", () => {
  it("allows up to the hourly limit per IP, then refuses", async () => {
    for (let i = 0; i < MAX_SIGNUPS_PER_IP; i++)
      expect(await allowSignup("203.0.113.1")).toBe(true);
    expect(await allowSignup("203.0.113.1")).toBe(false);
    expect(await allowSignup("203.0.113.2")).toBe(true);
  });

  it("does not limit when the IP is unknown", async () => {
    expect(await allowSignup(null)).toBe(true);
    expect(fake.current.attempts).toHaveLength(0);
  });
});

describe("recordLoginFailure", () => {
  it("prunes rows older than a day", async () => {
    fake.current.attempts.push({
      key: "login:email:old",
      createdAt: new Date(Date.now() - 25 * 3600_000),
    });
    await recordLoginFailure("ada@example.com", null);
    expect(fake.current.attempts.map((a) => a.key)).toEqual(["login:email:ada@example.com"]);
  });
});
