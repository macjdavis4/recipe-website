import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form/form-alert";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";
import { RESET_UNAVAILABLE } from "@/features/auth/messages";
import { getEmailSender } from "@/lib/email";

export const metadata: Metadata = { title: "Reset your password", robots: { index: false } };

// Whether email is on depends on runtime env, not the build.
export const dynamic = "force-dynamic";

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Reset your password"
      description="Enter the email you signed up with and we'll send you a link to choose a new password."
      footer={
        <p>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary underline underline-offset-4">
            Log in
          </Link>
        </p>
      }
    >
      {getEmailSender() ? <ForgotPasswordForm /> : <FormAlert message={RESET_UNAVAILABLE} />}
    </AuthCard>
  );
}
