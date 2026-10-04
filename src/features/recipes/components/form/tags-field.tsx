"use client";

import { useId, useState } from "react";
import { get, useController, useFormState } from "react-hook-form";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LIMITS, tagSchema, type RecipeInput } from "../../schemas";
import { FormSection } from "./section";

export function TagsField() {
  const id = useId();
  const { field } = useController<RecipeInput, "tags">({ name: "tags" });
  const { errors } = useFormState({ name: "tags" });
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string>();
  const tags = field.value;
  const fieldError = get(errors, "tags");
  const shownError = error ?? fieldError?.message ?? fieldError?.find?.((e: unknown) => e)?.message;

  function add() {
    const parsed = tagSchema.safeParse(draft);
    if (!draft.trim()) return;
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    if (tags.length >= LIMITS.tags) return setError(`Use up to ${LIMITS.tags} tags`);
    if (!tags.includes(parsed.data)) field.onChange([...tags, parsed.data]);
    setDraft("");
    setError(undefined);
  }

  return (
    <FormSection title="Tags" description="Optional. Add labels like vegan, gluten-free, or quick.">
      <div className="flex flex-col gap-2">
        <Label htmlFor={id}>Add a tag</Label>
        <div className="flex gap-2">
          <Input
            id={id}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                add();
              }
            }}
            aria-invalid={shownError ? true : undefined}
            aria-describedby={shownError ? `${id}-error` : undefined}
            placeholder="vegan"
          />
          <Button type="button" variant="outline" onClick={add}>
            Add
          </Button>
        </div>
        {shownError && (
          <p id={`${id}-error`} className="text-sm font-medium text-destructive">
            {shownError}
          </p>
        )}
      </div>
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Tags added">
          {tags.map((tag) => (
            <li
              key={tag}
              className="flex items-center rounded-full bg-secondary pl-3 text-sm text-secondary-foreground"
            >
              {tag}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="rounded-full"
                aria-label={`Remove tag ${tag}`}
                onClick={() => field.onChange(tags.filter((t) => t !== tag))}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </FormSection>
  );
}
