import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db", () => ({ db: { recipe: { findUnique: mocks.findUnique } } }));

const { assertRecipeOwner, requireUserId } = await import("./ownership");

const recipe = { id: "r1", slug: "dal", authorId: "owner", imageUrl: null };

beforeEach(() => vi.resetAllMocks());

describe("assertRecipeOwner", () => {
  it("returns the recipe for its author", async () => {
    mocks.findUnique.mockResolvedValue(recipe);
    await expect(assertRecipeOwner("r1", "owner")).resolves.toEqual(recipe);
  });

  it("throws ForbiddenError (403) for anyone else", async () => {
    mocks.findUnique.mockResolvedValue(recipe);
    const error = await assertRecipeOwner("r1", "intruder").catch((e) => e);
    expect(error).toBeInstanceOf(ForbiddenError);
    expect(error.status).toBe(403);
  });

  it("throws NotFoundError when the recipe is missing", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(assertRecipeOwner("missing", "owner")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("requireUserId", () => {
  it("returns the session user id", async () => {
    mocks.auth.mockResolvedValue({ user: { id: "u1" } });
    await expect(requireUserId()).resolves.toBe("u1");
  });

  it("throws UnauthorizedError without a session", async () => {
    mocks.auth.mockResolvedValue(null);
    await expect(requireUserId()).rejects.toBeInstanceOf(UnauthorizedError);
  });
});
