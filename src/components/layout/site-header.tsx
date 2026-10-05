import { ChefHat } from "lucide-react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { DesktopNav } from "./desktop-nav";
import { MobileSheet } from "./mobile-sheet";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
        <MobileSheet />
        <Link
          href="/"
          className="inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-md font-heading text-[0.9375rem] leading-tight font-semibold text-primary sm:gap-2 sm:text-xl md:text-lg lg:text-2xl"
        >
          <ChefHat className="size-5 shrink-0 sm:size-6" aria-hidden="true" />
          {/* Wraps to two lines on narrow phones instead of cutting the name off. */}
          <span className="line-clamp-2">{SITE_NAME}</span>
        </Link>
        <div className="flex-1 md:ml-4">
          <DesktopNav />
        </div>
        {/* On small screens the theme toggle lives in the mobile menu to make room for the name. */}
        <div className="hidden md:block">
          <ThemeToggle />
        </div>
        <UserMenu />
      </div>
    </header>
  );
}
