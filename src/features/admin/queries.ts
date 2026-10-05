import "server-only";
import { db } from "@/lib/db";

const DAY = 24 * 60 * 60 * 1000;
export const ADMIN_LIST_SIZE = 25;

export async function getAdminStats() {
  const since = (days: number) => ({ gte: new Date(Date.now() - days * DAY) });
  const [users, newUsers, recipes, newRecipes, aiDay, aiWeek] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: since(7) } }),
    db.recipe.count(),
    db.recipe.count({ where: { createdAt: since(7) } }),
    db.aiUsage.count({ where: { createdAt: since(1) } }),
    db.aiUsage.count({ where: { createdAt: since(7) } }),
  ]);
  return { users, newUsers, recipes, newRecipes, aiDay, aiWeek };
}

const contains = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Newest first; q matches name or email. */
export function listUsers(q: string) {
  return db.user.findMany({
    where: q ? { OR: [{ name: contains(q) }, { email: contains(q) }] } : undefined,
    orderBy: { createdAt: "desc" },
    take: ADMIN_LIST_SIZE,
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      _count: { select: { recipes: true } },
    },
  });
}

/** Newest first; q matches the title. */
export function listRecipes(q: string) {
  return db.recipe.findMany({
    where: q ? { title: contains(q) } : undefined,
    orderBy: { createdAt: "desc" },
    take: ADMIN_LIST_SIZE,
    select: {
      id: true,
      slug: true,
      title: true,
      createdAt: true,
      author: { select: { id: true, name: true } },
    },
  });
}
