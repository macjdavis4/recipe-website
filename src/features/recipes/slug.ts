const MAX_SLUG_LENGTH = 60;

// Slugs that would collide with fixed routes under /recipes.
const RESERVED_SLUGS = new Set(["new"]);

/** "Crème Brûlée (Easy!)" -> "creme-brulee-easy" */
export function slugify(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
  return slug || "recipe";
}

/** Returns slug, or slug-2, slug-3, ... whichever is free first. */
export async function uniqueSlug(
  title: string,
  isTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const base = slugify(title);
  const taken = async (slug: string) => RESERVED_SLUGS.has(slug) || (await isTaken(slug));
  if (!(await taken(base))) return base;
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  // Practically unreachable; fall back to a random suffix.
  return `${base}-${Math.random().toString(36).slice(2, 8)}`;
}
