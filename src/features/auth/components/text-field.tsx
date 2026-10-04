import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TextFieldProps = ComponentProps<typeof Input> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

export function TextField({ id, label, error, hint, ...inputProps }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
        {...inputProps}
      />
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
