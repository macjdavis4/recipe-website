import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";

const m = vi.hoisted(() => ({
  assertAdmin: vi.fn(),
  deleteUpload: vi.fn(),
  db: {
    recipe: { findUnique: vi.fn(), delete: vi.fn() },
    user: { findUnique: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("./access", () => ({ assertAdmin: m.assertAdmin }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/storage", () => ({ deleteUpload: m.deleteUpload }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { adminDeleteRecipe, adminDeleteUser } = await import("./actions");

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  m.assertAdmin.mockResolvedValue({ id: "admin", email: "owner@example.com" });
});

describe("adminDeleteRecipe", () => {
  it("refuses non-admins without touching anything", async () => {
    m.assertAdmin.mockRejectedValue(new ForbiddenError());
    expect(await adminDeleteRecipe("r1")).toEqual({ ok: false, message: expect.any(String) });
    expect(m.db.recipe.delete).not.toHaveBeenCalled();
  });

  it("deletes any author's recipe and its photo", async () => {
    m.db.recipe.findUnique.mockResolvedValue({
      id: "r1",
      title: "Soup",
      imageUrl: "/uploads/recipes/u9/a.jpg",
      authorId: "u9",
    });
    expect(await adminDeleteRecipe("r1")).toEqual({ ok: true });
    expect(m.db.recipe.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(m.deleteUpload).toHaveBeenCalledWith("/uploads/recipes/u9/a.jpg");
  });

  it("rejects malformed ids", async () => {
    await expect(adminDeleteRecipe({ id: "r1" })).rejects.toThrow();
    expect(m.db.recipe.delete).not.toHaveBeenCalled();
  });
});

describe("adminDeleteUser", () => {
  it("refuses non-admins", async () => {
    m.assertAdmin.mockRejectedValue(new ForbiddenError());
    expect((await adminDeleteUser("u9")).ok).toBe(false);
    expect(m.db.user.delete).not.toHaveBeenCalled();
  });

  it("won't delete the admin's own account", async () => {
    expect(await adminDeleteUser("admin")).toEqual({
      ok: false,
      message: "You can't delete your own account here.",
    });
    expect(m.db.user.delete).not.toHaveBeenCalled();
  });

  it("deletes the account and every recipe photo", async () => {
    m.db.user.findUnique.mockResolvedValue({
      id: "u9",
      recipes: [{ imageUrl: "/uploads/a.jpg" }, { imageUrl: null }, { imageUrl: "/uploads/b.jpg" }],
    });
    expect(await adminDeleteUser("u9")).toEqual({ ok: true });
    expect(m.db.user.delete).toHaveBeenCalledWith({ where: { id: "u9" } });
    expect(m.deleteUpload.mock.calls.map((c) => c[0])).toEqual([
      "/uploads/a.jpg",
      null,
      "/uploads/b.jpg",
    ]);
  });
});
