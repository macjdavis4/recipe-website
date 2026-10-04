"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { z } from "zod";
import type { RecipeData, RecipeInput } from "../../schemas";

// Loose shape check so a stale or hand-edited draft cannot crash the form.
const draftSchema = z
  .object({
    title: z.string(),
    description: z.string(),
    imageUrl: z.string().nullable(),
    prepMinutes: z.number(),
    cookMinutes: z.number(),
    servings: z.number(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    cuisine: z.string(),
    tags: z.array(z.string()),
    ingredients: z.array(
      z.object({ quantity: z.string(), unit: z.string(), name: z.string(), note: z.string() }),
    ),
    steps: z.array(z.object({ text: z.string() })),
  })
  .partial();

export function draftKeyFor(recipeId?: string): string {
  return recipeId ? `recipe-draft:edit:${recipeId}` : "recipe-draft:new";
}

/** Saves unsent form values to sessionStorage and restores them on return. */
export function useFormDraft(
  form: UseFormReturn<RecipeInput, unknown, RecipeData>,
  key: string,
  defaults: RecipeInput,
) {
  const [restored, setRestored] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(key);
      const parsed = raw ? draftSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success) {
        form.reset({ ...defaults, ...parsed.data });
        setRestored(true);
      }
    } catch {
      // Storage can be unavailable (private mode) or hold bad JSON. Start fresh.
    }
    const subscription = form.watch((values) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        try {
          sessionStorage.setItem(key, JSON.stringify(values));
        } catch {
          // Ignore quota or availability errors.
        }
      }, 400);
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(timer.current);
    };
    // Run once per form instance and key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    try {
      sessionStorage.removeItem(key);
    } catch {}
  }, [key]);

  const discard = useCallback(() => {
    clear();
    form.reset(defaults);
    setRestored(false);
  }, [clear, form, defaults]);

  return { restored, clear, discard };
}
