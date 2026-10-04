"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { loginAction } from "../actions";
import { loginSchema } from "../schemas";
import { FormAlert } from "./form-alert";
import { TextField } from "./text-field";

export function LoginForm({
  callbackUrl,
  initialError,
}: {
  callbackUrl: string;
  initialError?: string;
}) {
  const [serverError, setServerError] = useState(initialError);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await loginAction(values, callbackUrl);
    // Only reached on failure; success redirects.
    if (result?.message) setServerError(result.message);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <FormAlert message={serverError} />
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
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
