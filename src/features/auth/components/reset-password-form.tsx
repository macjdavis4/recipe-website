"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { resetPasswordAction } from "../actions";
import { resetPasswordSchema } from "../schemas";
import { TextField } from "./text-field";

export function ResetPasswordForm({ token }: { token: string }) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    // Success redirects to the login page.
    const result = await resetPasswordAction(values);
    if (!result) return;
    setServerError(result.message);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as "password" | "confirmPassword", { message }, { shouldFocus: true });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={serverError} />
      <input type="hidden" {...register("token")} />
      <TextField
        id="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register("password")}
      />
      <TextField
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register("confirmPassword")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save new password"}
      </Button>
    </form>
  );
}
