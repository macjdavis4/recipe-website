"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { FormAlert } from "@/components/form/form-alert";
import { FormNotice } from "@/components/form/form-notice";
import { Button } from "@/components/ui/button";
import { forgotPasswordAction } from "../actions";
import { forgotPasswordSchema } from "../schemas";
import { TextField } from "./text-field";

export const RESET_SENT =
  "If an account uses that email, we sent a link to reset its password. It works for 1 hour. Check your spam folder if it doesn't arrive.";

export function ForgotPasswordForm() {
  const [serverError, setServerError] = useState<string>();
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotPasswordSchema), defaultValues: { email: "" } });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(undefined);
    const result = await forgotPasswordAction(values);
    if (result.ok) setSent(true);
    else setServerError(result.message ?? result.fieldErrors?.email);
  });

  if (sent) return <FormNotice message={RESET_SENT} />;

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
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}
