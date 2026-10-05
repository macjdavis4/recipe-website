import Link from "next/link";
import type { listRecipes, listUsers } from "../queries";
import { DeleteButton } from "./delete-button";

const date = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const linkClass = "font-medium text-primary underline underline-offset-4";
const rowClass =
  "flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between";

export function UserList({
  users,
  adminId,
}: {
  users: Awaited<ReturnType<typeof listUsers>>;
  adminId: string;
}) {
  if (users.length === 0) return <p className="text-muted-foreground">No matching accounts.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label="Accounts">
      {users.map((user) => {
        const name = user.name ?? user.email;
        return (
          <li key={user.id} className={rowClass}>
            <div className="min-w-0">
              <Link href={`/u/${user.id}`} className={linkClass}>
                {name}
              </Link>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
              <p className="text-sm text-muted-foreground">
                Joined {date(user.createdAt)} · {user._count.recipes} recipe
                {user._count.recipes === 1 ? "" : "s"}
              </p>
            </div>
            {user.id === adminId ? (
              <p className="text-sm text-muted-foreground">This is you</p>
            ) : (
              <DeleteButton kind="user" id={user.id} name={name} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RecipeList({ recipes }: { recipes: Awaited<ReturnType<typeof listRecipes>> }) {
  if (recipes.length === 0) return <p className="text-muted-foreground">No matching recipes.</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label="Recipes">
      {recipes.map((recipe) => (
        <li key={recipe.id} className={rowClass}>
          <div className="min-w-0">
            <Link href={`/recipes/${recipe.slug}`} className={linkClass}>
              {recipe.title}
            </Link>
            <p className="text-sm text-muted-foreground">
              By{" "}
              <Link href={`/u/${recipe.author.id}`} className="underline underline-offset-4">
                {recipe.author.name ?? "a home cook"}
              </Link>{" "}
              on {date(recipe.createdAt)}
            </p>
          </div>
          <DeleteButton kind="recipe" id={recipe.id} name={recipe.title} />
        </li>
      ))}
    </ul>
  );
}
