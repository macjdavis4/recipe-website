import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DesktopNav } from "./desktop-nav";
import { MobileSheet } from "./mobile-sheet";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <MobileSheet />
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-md font-heading text-2xl font-semibold text-primary"
        >
          Larder
        </Link>
        <div className="ml-4 flex-1">
          <DesktopNav />
        </div>
        <ThemeToggle />
        {/* Replaced by the user menu once auth lands in Phase 2. */}
        <Button asChild variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </header>
  );
}
