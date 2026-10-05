import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormNotice } from "@/components/form/form-notice";
import { safeCallbackUrl } from "@/features/auth/callback-url";
import { AuthCard } from "@/features/auth/components/auth-card";
import { GoogleButton } from "@/features/auth/components/google-button";
import { LoginForm } from "@/features/auth/components/login-form";
import { oauthErrorMessage } from "@/features/auth/oauth-errors";
import { auth, isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; reset?: string }>;
}) {
  const { callbackUrl, error, reset } = await searchParams;
  const next = safeCallbackUrl(callbackUrl);
  if (await auth()) redirect(next);

  const signupHref = next === "/" ? "/signup" : `/signup?callbackUrl=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Log in"
      description="Welcome back. Log in to share and save recipes."
      footer={
        <p>
          New here?{" "}
          <Link href={signupHref} className="font-medium text-primary underline underline-offset-4">
            Create an account
          </Link>
        </p>
      }
    >
      {reset === "1" && <FormNotice message="Password updated. Log in with your new password." />}
      {isGoogleEnabled() && <GoogleButton callbackUrl={next} />}
      <LoginForm callbackUrl={next} initialError={oauthErrorMessage(error)} />
      <Link
        href="/forgot-password"
        className="-mt-2 inline-flex min-h-11 items-center self-start text-sm font-medium text-primary underline underline-offset-4"
      >
        Forgot your password?
      </Link>
    </AuthCard>
  );
}
