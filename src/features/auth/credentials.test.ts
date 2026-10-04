import bcrypt from "bcrypt";
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

// The real dummy hash costs 12 rounds by design; skip that cost here (covered in password.test.ts).
vi.mock("./password", () => ({
  verifyPassword: (password: string, hash: string | null | undefined) =>
    hash ? bcrypt.compare(password, hash) : Promise.resolve(false),
}));

const { verifyCredentials, LoginRateLimitedError } = await import("./credentials");
const { MAX_FAILURES_PER_EMAIL, MAX_FAILURES_PER_IP } = await import("./login-rate-limit");

const IP = "203.0.113.7";
const passwordHash = bcrypt.hashSync("correct horse", 4);

beforeEach(() => {
  fake.current = createFakeDb();
  fake.current.users.push({
    id: "u1",
    name: "Ada",
    email: "ada@example.com",
    passwordHash,
    image: null,
  });
});

describe("verifyCredentials", () => {
  it("returns the user for the right password, normalizing the email", async () => {
    const user = await verifyCredentials(
      { email: " ADA@example.com ", password: "correct horse" },
      IP,
    );
    expect(user).toEqual({ id: "u1", name: "Ada", email: "ada@example.com", image: null });
  });

  it("returns null for a wrong password and for an unknown email alike", async () => {
    expect(await verifyCredentials({ email: "ada@example.com", password: "nope" }, IP)).toBeNull();
    expect(
      await verifyCredentials({ email: "nobody@example.com", password: "nope" }, IP),
    ).toBeNull();
  });

  it("returns null for OAuth-only users with no password", async () => {
    fake.current.users.push({
      id: "u2",
      name: null,
      email: "g@example.com",
      passwordHash: null,
      image: null,
    });
    expect(
      await verifyCredentials({ email: "g@example.com", password: "anything" }, IP),
    ).toBeNull();
  });

  it("returns null for malformed input without recording a failure", async () => {
    expect(await verifyCredentials({ email: 42 }, IP)).toBeNull();
    expect(fake.current.attempts).toHaveLength(0);
  });

  it("blocks an email after too many failures, even with the right password", async () => {
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
      await verifyCredentials({ email: "ada@example.com", password: "nope" }, `198.51.100.${i}`);
    }
    await expect(
      verifyCredentials({ email: "ada@example.com", password: "correct horse" }, IP),
    ).rejects.toBeInstanceOf(LoginRateLimitedError);
  });

  it("blocks an IP after too many failures across different emails", async () => {
    for (let i = 0; i < MAX_FAILURES_PER_IP; i++) {
      await verifyCredentials({ email: `guess${i}@example.com`, password: "nope" }, IP);
    }
    await expect(
      verifyCredentials({ email: "ada@example.com", password: "correct horse" }, IP),
    ).rejects.toBeInstanceOf(LoginRateLimitedError);
  });

  it("clears an email's failures after a successful login", async () => {
    for (let i = 0; i < MAX_FAILURES_PER_EMAIL - 1; i++) {
      await verifyCredentials({ email: "ada@example.com", password: "nope" }, IP);
    }
    await verifyCredentials({ email: "ada@example.com", password: "correct horse" }, IP);
    expect(fake.current.attempts.filter((a) => a.key.startsWith("login:email:"))).toHaveLength(0);
  });

  it("ignores failures older than the window", async () => {
    vi.useFakeTimers();
    try {
      for (let i = 0; i < MAX_FAILURES_PER_EMAIL; i++) {
        await verifyCredentials({ email: "ada@example.com", password: "nope" }, IP);
      }
      vi.advanceTimersByTime(16 * 60 * 1000);
      const user = await verifyCredentials(
        { email: "ada@example.com", password: "correct horse" },
        IP,
      );
      expect(user?.id).toBe("u1");
    } finally {
      vi.useRealTimers();
    }
  });
});
