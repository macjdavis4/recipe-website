import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <p className="text-sm font-semibold text-terracotta">404</p>
      <h1 className="text-3xl font-semibold">We could not find that page</h1>
      <p className="text-muted-foreground">It may have moved, or it is not built yet.</p>
      <Button asChild>
        <Link href="/">Go home</Link>
      </Button>
    </section>
  );
}
