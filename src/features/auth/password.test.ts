import { describe, expect, it } from "vitest";
import { BCRYPT_COST, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes with cost 12 and verifies the original password only", async () => {
    const hash = await hashPassword("correct horse");
    expect(BCRYPT_COST).toBe(12);
    expect(hash).toMatch(/^\$2[aby]\$12\$/);
    expect(await verifyPassword("correct horse", hash)).toBe(true);
    expect(await verifyPassword("wrong horse", hash)).toBe(false);
  });

  it("returns false when there is no hash, still doing the bcrypt work", async () => {
    const started = performance.now();
    expect(await verifyPassword("anything", null)).toBe(false);
    // A real cost-12 compare takes well over 20ms; an early return would not.
    expect(performance.now() - started).toBeGreaterThan(20);
  });
});
