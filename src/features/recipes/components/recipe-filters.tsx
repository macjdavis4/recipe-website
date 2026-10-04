import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { DIFFICULTIES, DIFFICULTY_LABELS, type RecipeFilters as Filters } from "../schemas";

type Props = { filters: Filters; cuisines: string[]; tags: string[] };

/** A plain GET form, so search and filters work without JavaScript and are shareable. */
export function RecipeFilters({ filters, cuisines, tags }: Props) {
  const active = Boolean(filters.q || filters.cuisine || filters.difficulty || filters.tag);

  return (
    <form
      action="/recipes"
      method="get"
      role="search"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="q">Search recipes</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={filters.q}
            placeholder="Title or ingredient"
            className="pl-9"
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="cuisine">Cuisine</Label>
          <NativeSelect id="cuisine" name="cuisine" defaultValue={filters.cuisine ?? ""}>
            <option value="">Any cuisine</option>
            {cuisines.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="difficulty">Difficulty</Label>
          <NativeSelect id="difficulty" name="difficulty" defaultValue={filters.difficulty ?? ""}>
            <option value="">Any difficulty</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABELS[d]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="tag">Tag</Label>
          <NativeSelect id="tag" name="tag" defaultValue={filters.tag ?? ""}>
            <option value="">Any tag</option>
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Show recipes</Button>
        {active && (
          <Button asChild variant="ghost">
            <Link href="/recipes">Clear filters</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
