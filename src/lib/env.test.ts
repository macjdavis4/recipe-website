import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const base = { DATABASE_URL: "postgresql://larder:pw@localhost:5432/larder" };
const secret = "x".repeat(32);

describe("parseEnv", () => {
  it("applies defaults for a minimal dev config", () => {
    const env = parseEnv({ ...base, NODE_ENV: "development" });
    expect(env.AI_RATE_LIMIT_PER_HOUR).toBe(30);
    expect(env.AI_MODEL).toBe("claude-haiku-4-5-20251001");
    expect(env.STORAGE_DRIVER).toBe("local");
  });

  it("coerces the rate limit from a string", () => {
    expect(parseEnv({ ...base, AI_RATE_LIMIT_PER_HOUR: "5" }).AI_RATE_LIMIT_PER_HOUR).toBe(5);
  });

  it("rejects a non-positive rate limit", () => {
    expect(() => parseEnv({ ...base, AI_RATE_LIMIT_PER_HOUR: "0" })).toThrow(
      /AI_RATE_LIMIT_PER_HOUR/,
    );
  });

  it("requires a postgres DATABASE_URL", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ DATABASE_URL: "mysql://localhost/db" })).toThrow(/DATABASE_URL/);
  });

  it("treats blank optional values as unset", () => {
    const env = parseEnv({ ...base, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" });
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  it("requires the Google secret when the client id is set", () => {
    expect(() => parseEnv({ ...base, GOOGLE_CLIENT_ID: "abc" })).toThrow(/GOOGLE_CLIENT_SECRET/);
  });

  it("requires AUTH_SECRET and ANTHROPIC_API_KEY in production", () => {
    expect(() => parseEnv({ ...base, NODE_ENV: "production" })).toThrow(/AUTH_SECRET/);
    expect(() => parseEnv({ ...base, NODE_ENV: "production", AUTH_SECRET: secret })).toThrow(
      /ANTHROPIC_API_KEY/,
    );
    expect(() =>
      parseEnv({ ...base, NODE_ENV: "production", AUTH_SECRET: secret, AI_PROVIDER: "mock" }),
    ).not.toThrow();
  });

  it("requires every Spaces setting when STORAGE_DRIVER=spaces", () => {
    expect(() => parseEnv({ ...base, STORAGE_DRIVER: "spaces" })).toThrow(/SPACES_BUCKET/);
  });

  it("never includes secret values in the error message", () => {
    const leaked = "sk-ant-super-secret-value";
    try {
      parseEnv({
        ...base,
        NODE_ENV: "production",
        ANTHROPIC_API_KEY: leaked,
        AUTH_SECRET: "short",
      });
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain(leaked);
      expect(String(error)).not.toContain("short");
    }
  });
});
