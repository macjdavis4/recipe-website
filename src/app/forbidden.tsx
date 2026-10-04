import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <section className="flex flex-col items-start gap-4 py-12">
      <p className="text-sm font-semibold text-terracotta">403</p>
      <h1 className="text-3xl font-semibold">You cannot edit this recipe</h1>
      <p className="text-muted-foreground">Only the person who shared a recipe can change it.</p>
      <Button asChild>
        <Link href="/recipes">Browse recipes</Link>
      </Button>
    </section>
  );
}
