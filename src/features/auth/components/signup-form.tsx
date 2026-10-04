"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { signupAction } from "../actions";
import { signupSchema } from "../schemas";
import { FormAlert } from "./form-alert";
import { TextField } from "./text-field";

export function SignupForm({ callbackUrl }: { callbackUrl: string }) {
  const [serverError, setServerError] = useState<string>();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await signupAction(values, callbackUrl);
    if (!result) return;
    setServerError(result.message);
    for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
      setError(field as "name" | "email" | "password", { message }, { shouldFocus: true });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={serverError} />
      <TextField
        id="name"
        label="Name"
        autoComplete="name"
        error={errors.name?.message}
        {...register("name")}
      />
      <TextField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <TextField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
