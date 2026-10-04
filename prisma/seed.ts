/**
 * Loads demo users and recipes. Safe to run more than once: users are
 * upserted by email and seed recipes are replaced by slug.
 *
 *   pnpm db:seed
 *
 * Demo users share one password: SEED_PASSWORD, or "cookbook-demo" outside
 * production. In production SEED_PASSWORD is required.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { normalizeIngredientName } from "../src/features/recipes/normalize";
import { recipeSchema } from "../src/features/recipes/schemas";
import { SEED_RECIPES, SEED_USERS } from "./seed-data";

const db = new PrismaClient();

async function main() {
  const password =
    process.env.SEED_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "cookbook-demo");
  if (password.length < 8)
    throw new Error("Set SEED_PASSWORD (8+ characters) to seed in production.");
  const passwordHash = await bcrypt.hash(password, 12);

  const userIds = new Map<string, string>();
  for (const user of SEED_USERS) {
    const row = await db.user.upsert({
      where: { email: user.email },
      update: { name: user.name, passwordHash },
      create: { name: user.name, email: user.email, passwordHash },
    });
    userIds.set(user.key, row.id);
  }

  // Oldest first, an hour apart, so "newest" ordering is stable.
  const start = Date.now() - SEED_RECIPES.length * 3600_000;
  for (const [index, seed] of SEED_RECIPES.entries()) {
    const data = recipeSchema.parse(seed);
    await db.recipe.deleteMany({ where: { slug: seed.slug } });
    await db.recipe.create({
      data: {
        slug: seed.slug,
        authorId: userIds.get(seed.author)!,
        createdAt: new Date(start + index * 3600_000),
        title: data.title,
        description: data.description,
        imageUrl: seed.imageUrl,
        prepMinutes: data.prepMinutes,
        cookMinutes: data.cookMinutes,
        servings: data.servings,
        difficulty: data.difficulty,
        cuisine: data.cuisine || null,
        ingredients: {
          create: data.ingredients.map((i, position) => ({
            position,
            quantity: i.quantity || null,
            unit: i.unit || null,
            name: i.name,
            normalizedName: normalizeIngredientName(i.name),
            note: i.note || null,
          })),
        },
        steps: { create: data.steps.map((s, position) => ({ position, text: s.text })) },
        tags: {
          create: data.tags.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
      },
    });
  }

  console.log(`Seeded ${SEED_USERS.length} users and ${SEED_RECIPES.length} recipes.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
