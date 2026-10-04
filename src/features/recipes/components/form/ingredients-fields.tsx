"use client";

import { Plus } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { ArrayError, TextInputField } from "@/components/form/field";
import { Button } from "@/components/ui/button";
import { LIMITS, type RecipeInput } from "../../schemas";
import { ItemControls } from "./item-controls";
import { FormSection } from "./section";

export function IngredientsFields() {
  const { fields, append, move, remove } = useFieldArray<RecipeInput, "ingredients">({
    name: "ingredients",
  });

  return (
    <FormSection title="Ingredients" description="Quantities can be fractions like 1/2 or 1 1/2.">
      <ol className="flex flex-col gap-4">
        {fields.map((field, index) => (
          <li
            key={field.id}
            className="flex flex-col gap-3 border-b pb-4 last:border-b-0 last:pb-0"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-sans text-sm font-semibold">Ingredient {index + 1}</h3>
              <ItemControls
                label={`ingredient ${index + 1}`}
                index={index}
                count={fields.length}
                onMove={move}
                onRemove={remove}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-[6rem_7rem_1fr]">
              <TextInputField
                name={`ingredients.${index}.quantity`}
                label="Amount"
                placeholder="1 1/2"
              />
              <TextInputField name={`ingredients.${index}.unit`} label="Unit" placeholder="cups" />
              <TextInputField
                name={`ingredients.${index}.name`}
                label="Ingredient"
                placeholder="red lentils"
                className="col-span-2 sm:col-span-1"
              />
            </div>
            <TextInputField
              name={`ingredients.${index}.note`}
              label="Note (optional)"
              placeholder="rinsed"
            />
          </li>
        ))}
      </ol>
      <ArrayError name="ingredients" />
      <Button
        type="button"
        variant="outline"
        className="self-start"
        disabled={fields.length >= LIMITS.ingredients}
        onClick={() => append({ quantity: "", unit: "", name: "", note: "" })}
      >
        <Plus aria-hidden="true" />
        Add ingredient
      </Button>
    </FormSection>
  );
}
