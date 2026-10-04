import { describe, expect, it } from "vitest";
import { loginSchema, signupSchema } from "./schemas";

describe("signupSchema", () => {
  const valid = { name: " Ada ", email: " Ada@Example.COM ", password: "correct horse" };

  it("trims the name and normalizes the email", () => {
    expect(signupSchema.parse(valid)).toEqual({
      name: "Ada",
      email: "ada@example.com",
      password: "correct horse",
    });
  });

  it("requires a password of at least 8 characters", () => {
    expect(signupSchema.safeParse({ ...valid, password: "short" }).success).toBe(false);
  });

  it("rejects passwords over bcrypt's 72-byte limit, counting bytes not characters", () => {
    expect(signupSchema.safeParse({ ...valid, password: "a".repeat(72) }).success).toBe(true);
    expect(signupSchema.safeParse({ ...valid, password: "a".repeat(73) }).success).toBe(false);
    // 25 three-byte characters = 75 bytes
    expect(signupSchema.safeParse({ ...valid, password: "€".repeat(25) }).success).toBe(false);
  });

  it("rejects a blank name and an invalid email", () => {
    expect(signupSchema.safeParse({ ...valid, name: "   " }).success).toBe(false);
    expect(signupSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("normalizes the email and does not enforce password rules", () => {
    expect(loginSchema.parse({ email: "A@B.co", password: "x" })).toEqual({
      email: "a@b.co",
      password: "x",
    });
  });

  it("requires both fields", () => {
    expect(loginSchema.safeParse({ email: "", password: "" }).success).toBe(false);
  });
});
