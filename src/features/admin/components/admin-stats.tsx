import type { getAdminStats } from "../queries";

type Stats = Awaited<ReturnType<typeof getAdminStats>>;

export function AdminStats({ stats }: { stats: Stats }) {
  const items = [
    ["Accounts", stats.users, `${stats.newUsers} new this week`],
    ["Recipes", stats.recipes, `${stats.newRecipes} new this week`],
    ["AI requests today", stats.aiDay, `${stats.aiWeek} this week`],
  ] as const;

  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      {items.map(([label, value, detail]) => (
        <div key={label} className="rounded-lg border bg-card p-4">
          <dt className="text-sm text-muted-foreground">{label}</dt>
          <dd className="text-3xl font-semibold">{value.toLocaleString("en-US")}</dd>
          <dd className="text-sm text-muted-foreground">{detail}</dd>
        </div>
      ))}
    </dl>
  );
}
