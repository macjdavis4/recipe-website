import type { Metadata } from "next";
import Link from "next/link";
import { FormAlert } from "@/components/form/form-alert";
import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
  // The token is in the URL; never send it to another site as a referrer.
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <AuthCard
      title="Choose a new password"
      description="After saving, you'll be signed out everywhere and can log in with the new password."
      footer={
        <p>
          Need a new link?{" "}
          <Link
            href="/forgot-password"
            className="font-medium text-primary underline underline-offset-4"
          >
            Request one
          </Link>
        </p>
      }
    >
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <FormAlert message="This reset link is incomplete. Open the link from your email again, or request a new one." />
      )}
    </AuthCard>
  );
}
