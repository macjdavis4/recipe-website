import { describe, expect, it } from "vitest";
import { startedBeforePasswordChange } from "./session-check";

describe("startedBeforePasswordChange", () => {
  const changed = new Date("2026-10-05T12:00:00Z");

  it("keeps every session when the password was never reset", () => {
    expect(startedBeforePasswordChange(undefined, null)).toBe(false);
    expect(startedBeforePasswordChange(1, null)).toBe(false);
  });

  it("ends sessions that signed in before the reset", () => {
    expect(startedBeforePasswordChange(changed.getTime() - 1, changed)).toBe(true);
    expect(startedBeforePasswordChange(undefined, changed)).toBe(true);
  });

  it("keeps sessions that signed in after the reset", () => {
    expect(startedBeforePasswordChange(changed.getTime() + 1, changed)).toBe(false);
  });
});
