"use client";

import { Minus, Plus } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { LIMITS } from "../schemas";
import { ingredientLine } from "../format";
import { scaleQuantity } from "../scaling";

type Ingredient = {
  id: string;
  quantity: string | null;
  unit: string | null;
  name: string;
  note: string | null;
};

/** Servings adjuster plus a tick-off checklist. Quantities scale with servings. */
export function IngredientsPanel({
  servings,
  ingredients,
}: {
  servings: number;
  ingredients: Ingredient[];
}) {
  const [count, setCount] = useState(servings);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const statusId = useId();
  const factor = count / servings;

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section aria-labelledby="ingredients-title" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="ingredients-title" className="text-2xl font-semibold">
          Ingredients
        </h2>
        <div className="flex items-center gap-1" role="group" aria-label="Servings">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCount((c) => Math.max(1, c - 1))}
            disabled={count <= 1}
            aria-label="Fewer servings"
            aria-describedby={statusId}
          >
            <Minus aria-hidden="true" />
          </Button>
          <p id={statusId} aria-live="polite" className="min-w-24 text-center text-sm font-medium">
            {count} {count === 1 ? "serving" : "servings"}
          </p>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCount((c) => Math.min(LIMITS.servings, c + 1))}
            disabled={count >= LIMITS.servings}
            aria-label="More servings"
            aria-describedby={statusId}
          >
            <Plus aria-hidden="true" />
          </Button>
        </div>
      </div>
      <ul className="flex flex-col">
        {ingredients.map((ing) => {
          const done = checked.has(ing.id);
          return (
            <li key={ing.id} className="border-b last:border-b-0">
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2.5">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle(ing.id)}
                  className="mt-0.5 size-5 shrink-0 accent-primary"
                />
                <span className={done ? "text-muted-foreground line-through" : undefined}>
                  {ingredientLine({ ...ing, quantity: scaleQuantity(ing.quantity, factor) })}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {count !== servings && (
        <Button variant="link" className="self-start px-0" onClick={() => setCount(servings)}>
          Reset to {servings} servings
        </Button>
      )}
    </section>
  );
}
