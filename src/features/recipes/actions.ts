"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { deleteUpload, isOwnUpload } from "@/lib/storage";
import { normalizeIngredientName } from "./normalize";
import { assertRecipeOwner, requireUserId } from "./ownership";
import { recipeSchema, type RecipeData } from "./schemas";
import { uniqueSlug } from "./slug";

export type RecipeActionResult =
  | { ok: true; slug?: string; redirectTo: string }
  | { ok: false; status: number; message: string; fieldErrors?: Record<string, string> };

const INVALID = "Some fields need attention.";
const PHOTO_ERROR = "That photo could not be used. Upload it again.";

function failure(error: unknown): RecipeActionResult {
  if (error instanceof HttpError)
    return { ok: false, status: error.status, message: error.message };
  throw error;
}

function invalid(error: z.ZodError): RecipeActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) fieldErrors[issue.path.join(".")] ??= issue.message;
  return { ok: false, status: 400, message: INVALID, fieldErrors };
}

function childRows(data: RecipeData) {
  return {
    ingredients: data.ingredients.map((ing, position) => ({
      position,
      quantity: ing.quantity || null,
      unit: ing.unit || null,
      name: ing.name,
      normalizedName: normalizeIngredientName(ing.name),
      note: ing.note || null,
    })),
    steps: data.steps.map((step, position) => ({ position, text: step.text })),
    tags: data.tags.map((name) => ({
      tag: { connectOrCreate: { where: { name }, create: { name } } },
    })),
  };
}

function scalarFields(data: RecipeData) {
  return {
    title: data.title,
    description: data.description,
    imageUrl: data.imageUrl || null,
    prepMinutes: data.prepMinutes,
    cookMinutes: data.cookMinutes,
    servings: data.servings,
    difficulty: data.difficulty,
    cuisine: data.cuisine || null,
  };
}

function revalidateRecipe(slug: string, authorId: string) {
  revalidatePath("/");
  revalidatePath("/recipes");
  revalidatePath(`/recipes/${slug}`);
  revalidatePath(`/u/${authorId}`);
}

const slugTaken = async (slug: string) =>
  (await db.recipe.findUnique({ where: { slug }, select: { id: true } })) !== null;

export async function createRecipe(values: unknown): Promise<RecipeActionResult> {
  try {
    const userId = await requireUserId();
    const parsed = recipeSchema.safeParse(values);
    if (!parsed.success) return invalid(parsed.error);
    const data = parsed.data;
    if (data.imageUrl && !isOwnUpload(data.imageUrl, userId)) {
      return { ok: false, status: 400, message: INVALID, fieldErrors: { imageUrl: PHOTO_ERROR } };
    }

    const children = childRows(data);
    const create = async (slug: string) =>
      db.recipe.create({
        data: {
          ...scalarFields(data),
          slug,
          authorId: userId,
          ingredients: { create: children.ingredients },
          steps: { create: children.steps },
          tags: { create: children.tags },
        },
        select: { slug: true },
      });

    let recipe: { slug: string };
    try {
      recipe = await create(await uniqueSlug(data.title, slugTaken));
    } catch (error) {
      // Another recipe took the slug between our check and insert. Retry once.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"))
        throw error;
      recipe = await create(
        await uniqueSlug(`${data.title} ${Date.now().toString(36)}`, slugTaken),
      );
    }

    revalidateRecipe(recipe.slug, userId);
    return { ok: true, slug: recipe.slug, redirectTo: `/recipes/${recipe.slug}` };
  } catch (error) {
    return failure(error);
  }
}

export async function updateRecipe(recipeId: string, values: unknown): Promise<RecipeActionResult> {
  try {
    const userId = await requireUserId();
    const existing = await assertRecipeOwner(recipeId, userId);
    const parsed = recipeSchema.safeParse(values);
    if (!parsed.success) return invalid(parsed.error);
    const data = parsed.data;
    // Keeping the current photo is fine; a new one must be the author's own upload.
    if (
      data.imageUrl &&
      data.imageUrl !== existing.imageUrl &&
      !isOwnUpload(data.imageUrl, userId)
    ) {
      return { ok: false, status: 400, message: INVALID, fieldErrors: { imageUrl: PHOTO_ERROR } };
    }

    const children = childRows(data);
    await db.$transaction([
      db.ingredient.deleteMany({ where: { recipeId } }),
      db.step.deleteMany({ where: { recipeId } }),
      db.recipeTag.deleteMany({ where: { recipeId } }),
      db.recipe.update({
        where: { id: recipeId },
        data: {
          ...scalarFields(data),
          ingredients: { create: children.ingredients },
          steps: { create: children.steps },
          tags: { create: children.tags },
        },
      }),
    ]);

    if (existing.imageUrl && existing.imageUrl !== (data.imageUrl || null)) {
      await deleteUpload(existing.imageUrl);
    }
    // The slug stays the same on edit so shared links keep working.
    revalidateRecipe(existing.slug, userId);
    return { ok: true, slug: existing.slug, redirectTo: `/recipes/${existing.slug}` };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteRecipe(recipeId: string): Promise<RecipeActionResult> {
  try {
    const userId = await requireUserId();
    const existing = await assertRecipeOwner(recipeId, userId);
    // Ingredients, steps, and tag links cascade in the database.
    await db.recipe.delete({ where: { id: recipeId } });
    await deleteUpload(existing.imageUrl);
    revalidateRecipe(existing.slug, userId);
    return { ok: true, redirectTo: `/u/${userId}` };
  } catch (error) {
    return failure(error);
  }
}
