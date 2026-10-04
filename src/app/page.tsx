import Link from "next/link";
import { BookOpen, ChefHat, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: BookOpen,
    title: "Community recipes",
    body: "Browse dishes shared by home cooks. No account needed to read.",
  },
  {
    icon: ChefHat,
    title: "Cook from your pantry",
    body: "List what you have and get recipes that use it.",
  },
  {
    icon: Sparkles,
    title: "Ask the assistant",
    body: "Get help with swaps, timing, and technique while you cook.",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="hero-title" className="flex flex-col gap-5 py-6 md:py-12">
        <p className="text-sm font-semibold tracking-wide text-terracotta uppercase">
          Recipes from real kitchens
        </p>
        <h1 id="hero-title" className="max-w-2xl text-4xl font-semibold text-balance md:text-6xl">
          Cook what you love. Share what works.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Larder is a home for the recipes you actually make, with a little help for the nights you
          are not sure what to cook.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/recipes">Browse recipes</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/recipes/new">Share a recipe</Link>
          </Button>
        </div>
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="sr-only">
          What you can do
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <li key={title} className="rounded-xl border bg-card p-5 text-card-foreground">
              <Icon className="mb-3 size-6 text-primary" aria-hidden="true" />
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="mt-1 text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
