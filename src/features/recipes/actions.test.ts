import { beforeEach, describe, expect, it, vi } from "vitest";
import { emptyRecipe } from "./schemas";

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  isOwnUpload: vi.fn(),
  deleteUpload: vi.fn(),
  db: {
    recipe: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    ingredient: { deleteMany: vi.fn() },
    step: { deleteMany: vi.fn() },
    recipeTag: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/auth", () => ({ auth: m.auth }));
vi.mock("@/lib/db", () => ({ db: m.db }));
vi.mock("@/lib/storage", () => ({ isOwnUpload: m.isOwnUpload, deleteUpload: m.deleteUpload }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { createRecipe, updateRecipe, deleteRecipe } = await import("./actions");

const input = {
  ...emptyRecipe,
  title: "Weeknight Dal",
  description: "Lentils and spices.",
  cuisine: "indian",
  tags: ["vegan"],
  ingredients: [{ quantity: "1", unit: "cup", name: "Red Lentils", note: "" }],
  steps: [{ text: "Simmer." }],
};
const owned = { id: "r1", slug: "weeknight-dal", authorId: "owner", imageUrl: "/uploads/old.jpg" };

const signIn = (id: string | null) => m.auth.mockResolvedValue(id ? { user: { id } } : null);
const writes = () => [
  m.db.recipe.create,
  m.db.recipe.update,
  m.db.recipe.delete,
  m.db.ingredient.deleteMany,
  m.db.$transaction,
  m.deleteUpload,
];

beforeEach(() => {
  vi.resetAllMocks();
  m.db.recipe.findUnique.mockImplementation(async ({ where }) =>
    where.id === "r1" ? owned : null,
  );
  m.db.recipe.create.mockImplementation(async ({ data }) => ({ slug: data.slug }));
  m.db.$transaction.mockResolvedValue([]);
});

describe("createRecipe", () => {
  it("returns 401 for guests without writing", async () => {
    signIn(null);
    expect(await createRecipe(input)).toMatchObject({ ok: false, status: 401 });
    writes().forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("creates the recipe for the signed-in user with normalized children", async () => {
    signIn("owner");
    m.db.recipe.findUnique.mockResolvedValue(null);
    const result = await createRecipe(input);

    expect(result).toEqual({
      ok: true,
      slug: "weeknight-dal",
      redirectTo: "/recipes/weeknight-dal",
    });
    const { data } = m.db.recipe.create.mock.calls[0][0];
    expect(data.authorId).toBe("owner");
    expect(data.cuisine).toBe("Indian");
    expect(data.ingredients.create[0]).toMatchObject({
      position: 0,
      normalizedName: "red lentil",
      note: null,
    });
  });

  it("ignores any authorId sent by the client", async () => {
    signIn("owner");
    m.db.recipe.findUnique.mockResolvedValue(null);
    await createRecipe({ ...input, authorId: "someone-else" });
    expect(m.db.recipe.create.mock.calls[0][0].data.authorId).toBe("owner");
  });

  it("rejects a photo URL that is not the user's own upload", async () => {
    signIn("owner");
    m.isOwnUpload.mockReturnValue(false);
    const result = await createRecipe({ ...input, imageUrl: "https://evil.example/x.jpg" });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      fieldErrors: { imageUrl: expect.any(String) },
    });
    expect(m.db.recipe.create).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    signIn("owner");
    const result = await createRecipe({ ...input, title: "", steps: [] });
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(Object.keys((result as { fieldErrors: object }).fieldErrors)).toEqual(
      expect.arrayContaining(["title", "steps"]),
    );
  });
});

describe("updateRecipe", () => {
  it("returns 403 for a signed-in user who is not the author, without writing", async () => {
    signIn("intruder");
    expect(await updateRecipe("r1", input)).toMatchObject({ ok: false, status: 403 });
    writes().forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("returns 401 for guests and 404 for missing recipes", async () => {
    signIn(null);
    expect(await updateRecipe("r1", input)).toMatchObject({ status: 401 });
    signIn("owner");
    expect(await updateRecipe("nope", input)).toMatchObject({ status: 404 });
  });

  it("lets the author update, keeps the slug, and cleans up a replaced photo", async () => {
    signIn("owner");
    m.isOwnUpload.mockReturnValue(true);
    const result = await updateRecipe("r1", {
      ...input,
      title: "New Title",
      imageUrl: "/uploads/new.jpg",
    });

    expect(result).toEqual({
      ok: true,
      slug: "weeknight-dal",
      redirectTo: "/recipes/weeknight-dal",
    });
    expect(m.db.$transaction).toHaveBeenCalledOnce();
    expect(m.deleteUpload).toHaveBeenCalledWith("/uploads/old.jpg");
  });

  it("allows keeping the current photo without re-checking it", async () => {
    signIn("owner");
    m.isOwnUpload.mockReturnValue(false);
    expect(await updateRecipe("r1", { ...input, imageUrl: owned.imageUrl })).toMatchObject({
      ok: true,
    });
    expect(m.deleteUpload).not.toHaveBeenCalled();
  });
});

describe("deleteRecipe", () => {
  it("returns 403 for a non-author and leaves the recipe alone", async () => {
    signIn("intruder");
    expect(await deleteRecipe("r1")).toMatchObject({ ok: false, status: 403 });
    writes().forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });

  it("deletes for the author and removes the photo", async () => {
    signIn("owner");
    expect(await deleteRecipe("r1")).toEqual({ ok: true, redirectTo: "/u/owner" });
    expect(m.db.recipe.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(m.deleteUpload).toHaveBeenCalledWith("/uploads/old.jpg");
  });
});
