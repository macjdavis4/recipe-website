import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

describe("clientIp", () => {
  it("uses the last X-Forwarded-For hop, which our proxy appended", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 203.0.113.9" }))).toBe(
      "203.0.113.9",
    );
  });

  it("falls back to X-Real-IP and then null", () => {
    expect(clientIp(new Headers({ "x-real-ip": "203.0.113.5" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers())).toBeNull();
  });
});
