import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { normalizeIngredientName } from "./normalize";
import type { RecipeFilters } from "./schemas";

export const PAGE_SIZE = 12;

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  imageUrl: true,
  prepMinutes: true,
  cookMinutes: true,
  difficulty: true,
  cuisine: true,
  author: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
} satisfies Prisma.RecipeSelect;

type CardRow = Prisma.RecipeGetPayload<{ select: typeof cardSelect }>;
export type RecipeCardData = Omit<CardRow, "tags"> & { tags: string[] };

const toCard = ({ tags, ...recipe }: CardRow): RecipeCardData => ({
  ...recipe,
  tags: tags.map((t) => t.tag.name),
});

export function buildRecipeWhere(filters: RecipeFilters): Prisma.RecipeWhereInput {
  const and: Prisma.RecipeWhereInput[] = [];
  if (filters.q) {
    const q = filters.q;
    const ingredient = normalizeIngredientName(q);
    and.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { cuisine: { contains: q, mode: "insensitive" } },
        ...(ingredient
          ? [{ ingredients: { some: { normalizedName: { contains: ingredient } } } }]
          : []),
      ],
    });
  }
  if (filters.cuisine) and.push({ cuisine: { equals: filters.cuisine, mode: "insensitive" } });
  if (filters.difficulty) and.push({ difficulty: filters.difficulty });
  if (filters.tag) and.push({ tags: { some: { tag: { name: filters.tag } } } });
  return and.length ? { AND: and } : {};
}

export async function listRecipes(filters: RecipeFilters) {
  const where = buildRecipeWhere(filters);
  const page = filters.page ?? 1;
  const [rows, total] = await db.$transaction([
    db.recipe.findMany({
      where,
      select: cardSelect,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.recipe.count({ where }),
  ]);
  return {
    recipes: rows.map(toCard),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

export async function getFilterOptions() {
  const [cuisines, tags] = await Promise.all([
    db.recipe.findMany({
      where: { cuisine: { not: null } },
      distinct: ["cuisine"],
      select: { cuisine: true },
      orderBy: { cuisine: "asc" },
    }),
    db.tag.findMany({
      where: { recipes: { some: {} } },
      select: { name: true },
      orderBy: { recipes: { _count: "desc" } },
      take: 30,
    }),
  ]);
  return {
    cuisines: cuisines.map((c) => c.cuisine).filter((c): c is string => Boolean(c)),
    tags: tags.map((t) => t.name).sort(),
  };
}

export async function getRecipeBySlug(slug: string) {
  const recipe = await db.recipe.findUnique({
    where: { slug },
    include: {
      author: { select: { id: true, name: true, image: true } },
      ingredients: { orderBy: { position: "asc" } },
      steps: { orderBy: { position: "asc" } },
      tags: { select: { tag: { select: { name: true } } }, orderBy: { tag: { name: "asc" } } },
    },
  });
  return recipe && { ...recipe, tags: recipe.tags.map((t) => t.tag.name) };
}

export type RecipeDetail = NonNullable<Awaited<ReturnType<typeof getRecipeBySlug>>>;

export async function getProfile(userId: string) {
  return db.user
    .findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
        recipes: { select: cardSelect, orderBy: { createdAt: "desc" } },
      },
    })
    .then((user) => user && { ...user, recipes: user.recipes.map(toCard) });
}
