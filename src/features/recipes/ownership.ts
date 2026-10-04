import "server-only";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { ForbiddenError, NotFoundError, UnauthorizedError } from "@/lib/errors";

/** The signed-in user's id, or UnauthorizedError. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/**
 * The single ownership check for recipes (CLAUDE.md rule 1). Every update and
 * delete goes through this. Throws NotFoundError or ForbiddenError (403).
 */
export async function assertRecipeOwner(recipeId: string, userId: string) {
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: { id: true, slug: true, authorId: true, imageUrl: true },
  });
  if (!recipe) throw new NotFoundError("That recipe does not exist.");
  if (recipe.authorId !== userId) throw new ForbiddenError("You can only change your own recipes.");
  return recipe;
}
