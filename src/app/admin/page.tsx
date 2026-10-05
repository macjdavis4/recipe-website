import type { Metadata } from "next";
import { requireAdminPage } from "@/features/admin/access";
import { AdminSearch } from "@/features/admin/components/admin-search";
import { AdminStats } from "@/features/admin/components/admin-stats";
import { RecipeList, UserList } from "@/features/admin/components/admin-lists";
import { ADMIN_LIST_SIZE, getAdminStats, listRecipes, listUsers } from "@/features/admin/queries";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const text = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim().slice(0, 100) : "";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Everyone but an admin gets a 404 here.
  const admin = await requireAdminPage();
  const params = await searchParams;
  const q = text(params.q);
  const rq = text(params.rq);
  const [stats, users, recipes] = await Promise.all([
    getAdminStats(),
    listUsers(q),
    listRecipes(rq),
  ]);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold md:text-4xl">Admin</h1>
        <p className="text-muted-foreground">
          Only accounts listed in ADMIN_EMAILS can see this page. Deletions can&apos;t be undone.
        </p>
      </header>

      <section aria-labelledby="stats-title" className="flex flex-col gap-4">
        <h2 id="stats-title" className="text-2xl font-semibold">
          Overview
        </h2>
        <AdminStats stats={stats} />
      </section>

      <section aria-labelledby="users-title" className="flex flex-col gap-4">
        <h2 id="users-title" className="text-2xl font-semibold">
          Accounts
        </h2>
        <AdminSearch name="q" label="Search by name or email" value={q} keep={{ rq }} />
        <p className="text-sm text-muted-foreground">
          Newest first, up to {ADMIN_LIST_SIZE}. Use this for account deletion requests.
        </p>
        <UserList users={users} adminId={admin.id} />
      </section>

      <section aria-labelledby="recipes-title" className="flex flex-col gap-4">
        <h2 id="recipes-title" className="text-2xl font-semibold">
          Recipes
        </h2>
        <AdminSearch name="rq" label="Search recipes by title" value={rq} keep={{ q }} />
        <p className="text-sm text-muted-foreground">Newest first, up to {ADMIN_LIST_SIZE}.</p>
        <RecipeList recipes={recipes} />
      </section>
    </div>
  );
}
