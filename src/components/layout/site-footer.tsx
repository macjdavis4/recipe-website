import Link from "next/link";
import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

const linkClass =
  "inline-flex min-h-11 items-center underline-offset-4 hover:text-foreground hover:underline";

export function SiteFooter() {
  return (
    // Bottom padding keeps the footer clear of the mobile tab bar.
    <footer className="border-t px-4 pt-2 pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-sm text-muted-foreground md:pb-4">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6">
        <p className="min-h-11 content-center">{SITE_NAME}</p>
        <nav aria-label="Footer" className="flex gap-6">
          <Link href="/privacy" className={linkClass}>
            Privacy
          </Link>
          <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
