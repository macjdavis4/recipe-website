import { beforeEach, describe, expect, it, vi } from "vitest";
import { AIOutputError } from "@/lib/ai/provider";
import { post } from "../test-helpers";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  assertWithinAiLimit: vi.fn(),
  recordAiUsage: vi.fn(),
  findRecipe: vi.fn(),
  provider: { name: "stub", streamText: vi.fn(), generateObject: vi.fn() },
}));

vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/features/ai/rate-limit", async (orig) => ({
  ...(await orig<typeof import("@/features/ai/rate-limit")>()),
  assertWithinAiLimit: m.assertWithinAiLimit,
  recordAiUsage: m.recordAiUsage,
}));
vi.mock("@/lib/ai", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai")>()),
  getAIProvider: () => m.provider,
}));

const { POST } = await import("./route");
const ask = (body: unknown) => POST(post("http://localhost/api/ai/pantry", body));

const idea = {
  title: "Egg fried rice",
  description: "Quick and filling.",
  prepMinutes: 5,
  cookMinutes: 10,
  servings: 2,
  difficulty: "EASY",
  ingredients: [{ quantity: "2", unit: "", name: "eggs" }],
  steps: ["Scramble the eggs."],
  usesFromPantry: ["egg"],
  missing: [],
};

beforeEach(() => {
  vi.resetAllMocks();
  m.auth.mockResolvedValue({ user: { id: "u1" } });
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/ai/pantry", () => {
  it("requires login", async () => {
    m.auth.mockResolvedValue(null);
    expect((await ask({ items: ["egg"] })).status).toBe(401);
  });

  it("validates input", async () => {
    expect((await ask({ items: [] })).status).toBe(400);
    expect((await ask({ nope: true })).status).toBe(400);
  });

  it("returns validated ideas and sends normalized items to the model", async () => {
    m.provider.generateObject.mockResolvedValue({ ideas: [idea] });
    const res = await ask({ items: ["Eggs", "eggs", "Rice"] });
    expect(res.status).toBe(200);
    expect((await res.json()).ideas[0].title).toBe("Egg fried rice");
    expect(m.provider.generateObject.mock.calls[0][0].prompt).toContain(
      "<pantry>\negg\nrice\n</pantry>",
    );
    expect(m.recordAiUsage).toHaveBeenCalledOnce();
  });

  it("retries once when the output fails validation, without logging usage twice", async () => {
    m.provider.generateObject
      .mockResolvedValueOnce({ ideas: [{ ...idea, servings: -1 }] })
      .mockResolvedValueOnce({ ideas: [idea] });
    expect((await ask({ items: ["egg"] })).status).toBe(200);
    expect(m.provider.generateObject).toHaveBeenCalledTimes(2);
    expect(m.recordAiUsage).toHaveBeenCalledOnce();
  });

  it("gives up with 502 after two bad outputs", async () => {
    m.provider.generateObject
      .mockRejectedValueOnce(new AIOutputError())
      .mockResolvedValueOnce({ ideas: "nope" });
    const res = await ask({ items: ["egg"] });
    expect(res.status).toBe(502);
    expect(m.provider.generateObject).toHaveBeenCalledTimes(2);
  });
});
