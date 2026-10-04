"use client";

import { useId, type ReactNode } from "react";
import { get, useFormContext, useFormState } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ControlProps = { id: string; "aria-invalid"?: true; "aria-describedby"?: string };

type FieldProps = {
  name: string;
  label: string;
  hint?: string;
  className?: string;
  labelClassName?: string;
  children: (control: ControlProps) => ReactNode;
};

/** Label, hint, and error wiring for a react-hook-form field inside a FormProvider. */
export function Field({ name, label, hint, className, labelClassName, children }: FieldProps) {
  const id = useId();
  const { errors } = useFormState({ name });
  const error = get(errors, name)?.message as string | undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

type Common = Omit<FieldProps, "children"> & { placeholder?: string; autoComplete?: string };

export function TextInputField({ placeholder, autoComplete, ...field }: Common) {
  const { register } = useFormContext();
  return (
    <Field {...field}>
      {(control) => (
        <Input
          {...control}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...register(field.name)}
        />
      )}
    </Field>
  );
}

export function NumberField({ min, max, ...field }: Common & { min?: number; max?: number }) {
  const { register } = useFormContext();
  return (
    <Field {...field}>
      {(control) => (
        <Input
          {...control}
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          {...register(field.name, { valueAsNumber: true })}
        />
      )}
    </Field>
  );
}

export function TextareaField({ placeholder, rows = 3, ...field }: Common & { rows?: number }) {
  const { register } = useFormContext();
  return (
    <Field {...field}>
      {(control) => (
        <Textarea {...control} rows={rows} placeholder={placeholder} {...register(field.name)} />
      )}
    </Field>
  );
}

export function SelectField({
  options,
  ...field
}: Common & { options: { value: string; label: string }[] }) {
  const { register } = useFormContext();
  return (
    <Field {...field}>
      {(control) => (
        <NativeSelect {...control} {...register(field.name)}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      )}
    </Field>
  );
}

/** Error for an array as a whole (e.g. "Add at least one step"). */
export function ArrayError({ name }: { name: string }) {
  const { errors } = useFormState({ name });
  const error = get(errors, name);
  const message = (error?.message ?? error?.root?.message) as string | undefined;
  return message ? (
    <p role="alert" className="text-sm font-medium text-destructive">
      {message}
    </p>
  ) : null;
}
