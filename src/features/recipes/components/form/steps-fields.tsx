"use client";

import { Plus } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { ArrayError, TextareaField } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { LIMITS, type RecipeInput } from "../../schemas";
import { ItemControls } from "./item-controls";
import { FormSection } from "./section";

export function StepsFields() {
  const { fields, append, move, remove } = useFieldArray<RecipeInput, "steps">({ name: "steps" });

  return (
    <FormSection title="Steps">
      <ol className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <li key={field.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-sans text-sm font-semibold">Step {index + 1}</h3>
              <ItemControls
                label={`step ${index + 1}`}
                index={index}
                count={fields.length}
                onMove={move}
                onRemove={remove}
              />
            </div>
            <TextareaField
              name={`steps.${index}.text`}
              label={`Step ${index + 1} instructions`}
              labelClassName="sr-only"
              rows={3}
            />
          </li>
        ))}
      </ol>
      <ArrayError name="steps" />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={fields.length >= LIMITS.steps}
        onClick={() => append({ text: "" })}
      >
        <Plus aria-hidden="true" />
        Add step
      </Button>
    </FormSection>
  );
}
