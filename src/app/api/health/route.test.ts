import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ db: { $queryRaw: queryRaw } }));

const { GET } = await import("./route");

beforeEach(() => vi.resetAllMocks());

describe("GET /api/health", () => {
  it("returns 200 when the database answers", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", db: "ok" });
  });

  it("returns 503 without leaking error details when the database is down", async () => {
    queryRaw.mockRejectedValue(
      new Error("connect ECONNREFUSED postgresql://larder:secret@db:5432"),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await GET();
    expect(res.status).toBe(503);
    const body = JSON.stringify(await res.json());
    expect(body).not.toContain("secret");
    expect(body).not.toContain("ECONNREFUSED");
  });
});
