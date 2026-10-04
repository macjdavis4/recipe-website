import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RecipeFilters } from "../schemas";

function pageHref(filters: RecipeFilters, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: page > 1 ? page : undefined })) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `/recipes?${query}` : "/recipes";
}

export function Pagination({
  filters,
  page,
  pageCount,
}: {
  filters: RecipeFilters;
  page: number;
  pageCount: number;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-2">
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={pageHref(filters, page - 1)} rel="prev">
            <ChevronLeft aria-hidden="true" />
            Previous
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground">
        Page {page} of {pageCount}
      </p>
      {page < pageCount ? (
        <Button asChild variant="outline">
          <Link href={pageHref(filters, page + 1)} rel="next">
            Next
            <ChevronRight aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
