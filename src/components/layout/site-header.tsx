import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SITE_NAME } from "@/lib/site";
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
          className="inline-flex min-h-11 min-w-0 items-center rounded-md font-heading text-[0.9375rem] font-semibold text-primary sm:text-xl lg:text-2xl"
        >
          <span className="truncate">{SITE_NAME}</span>
        </Link>
        <div className="flex-1 md:ml-4">
          <DesktopNav />
        </div>
        {/* On small screens the theme toggle lives in the mobile menu to make room for the name. */}
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        {/* Replaced by the user menu once auth lands in Phase 2. */}
        <Button asChild variant="outline">
          <Link href="/login">Log in</Link>
        </Button>
      </div>
    </header>
  );
}
