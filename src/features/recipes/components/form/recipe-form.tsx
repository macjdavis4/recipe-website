"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormProvider, useForm, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { createRecipe, updateRecipe } from "../../actions";
import { recipeSchema, type RecipeData, type RecipeInput } from "../../schemas";
import { BasicsFields } from "./basics-fields";
import { IngredientsFields } from "./ingredients-fields";
import { PhotoField } from "./photo-field";
import { StepsFields } from "./steps-fields";
import { TagsField } from "./tags-field";
import { draftKeyFor, useFormDraft } from "./use-form-draft";

type Props = { recipeId?: string; defaultValues: RecipeInput; cancelHref: string };

export function RecipeForm({ recipeId, defaultValues, cancelHref }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string>();
  const form = useForm<RecipeInput, unknown, RecipeData>({
    resolver: zodResolver(recipeSchema),
    defaultValues,
    mode: "onTouched",
  });
  const draft = useFormDraft(form, draftKeyFor(recipeId), defaultValues);
  const { isSubmitting } = form.formState;

  const onSubmit = form.handleSubmit(
    async (values) => {
      setServerError(undefined);
      const result = recipeId ? await updateRecipe(recipeId, values) : await createRecipe(values);
      if (result.ok) {
        draft.clear();
        toast.success(recipeId ? "Recipe updated." : "Recipe shared.");
        router.push(result.redirectTo);
        router.refresh();
        return;
      }
      setServerError(result.message);
      for (const [path, message] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(path as FieldPath<RecipeInput>, { message });
      }
    },
    () => setServerError("Some fields need attention. Check the messages below."),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
        {draft.restored && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-accent p-3 text-sm text-accent-foreground">
            <p>We restored your unsaved changes.</p>
            <Button type="button" variant="ghost" onClick={draft.discard}>
              Discard changes
            </Button>
          </div>
        )}
        <FormAlert message={serverError} />
        <BasicsFields />
        <PhotoField />
        <IngredientsFields />
        <StepsFields />
        <TagsField />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" size="lg" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : recipeId ? "Save changes" : "Share recipe"}
          </Button>
          <Button asChild size="lg" variant="ghost">
            <Link href={cancelHref} onClick={draft.clear}>
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
