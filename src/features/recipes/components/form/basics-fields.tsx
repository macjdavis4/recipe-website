import { NumberField, SelectField, TextareaField, TextInputField } from "@/components/form/field";
import { DIFFICULTIES, DIFFICULTY_LABELS, LIMITS } from "../../schemas";
import { FormSection } from "./section";

const difficultyOptions = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d] }));

export function BasicsFields() {
  return (
    <FormSection title="The basics">
      <TextInputField name="title" label="Title" placeholder="Weeknight dal" />
      <TextareaField
        name="description"
        label="Description"
        placeholder="What makes this dish worth cooking?"
        rows={3}
      />
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="prepMinutes" label="Prep (min)" min={0} max={LIMITS.minutes} />
        <NumberField name="cookMinutes" label="Cook (min)" min={0} max={LIMITS.minutes} />
        <NumberField name="servings" label="Servings" min={1} max={LIMITS.servings} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField name="difficulty" label="Difficulty" options={difficultyOptions} />
        <TextInputField name="cuisine" label="Cuisine (optional)" placeholder="Indian" />
      </div>
    </FormSection>
  );
}
