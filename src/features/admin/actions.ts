"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { HttpError } from "@/lib/errors";
import { deleteUpload } from "@/lib/storage";
import { assertAdmin } from "./access";

export type AdminActionResult = { ok: true } | { ok: false; message: string };

const idSchema = z.string().min(1).max(64);

function failure(error: unknown): AdminActionResult {
  if (error instanceof HttpError) return { ok: false, message: error.message };
  throw error;
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

/** Removes any recipe (moderation). Editing stays owner-only. */
export async function adminDeleteRecipe(recipeId: unknown): Promise<AdminActionResult> {
  try {
    const admin = await assertAdmin();
    const id = idSchema.parse(recipeId);
    const recipe = await db.recipe.findUnique({
      where: { id },
      select: { id: true, title: true, imageUrl: true, authorId: true },
    });
    if (!recipe) return { ok: false, message: "That recipe was already deleted." };

    // Ingredients, steps, and tag links cascade in the database.
    await db.recipe.delete({ where: { id } });
    await deleteUpload(recipe.imageUrl);
    console.info(`[admin] ${admin.email} deleted recipe ${recipe.id} by user ${recipe.authorId}`);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}

/** Deletes an account with its recipes and photos (for deletion requests). */
export async function adminDeleteUser(userId: unknown): Promise<AdminActionResult> {
  try {
    const admin = await assertAdmin();
    const id = idSchema.parse(userId);
    if (id === admin.id) return { ok: false, message: "You can't delete your own account here." };

    const user = await db.user.findUnique({
      where: { id },
      select: { id: true, recipes: { select: { imageUrl: true } } },
    });
    if (!user) return { ok: false, message: "That account was already deleted." };

    // Recipes, sign-in links, AI usage, and reset tokens cascade with the user.
    await db.user.delete({ where: { id } });
    for (const { imageUrl } of user.recipes) await deleteUpload(imageUrl);
    console.info(`[admin] ${admin.email} deleted user ${id} and ${user.recipes.length} recipe(s)`);
    revalidateAll();
    return { ok: true };
  } catch (error) {
    return failure(error);
  }
}
