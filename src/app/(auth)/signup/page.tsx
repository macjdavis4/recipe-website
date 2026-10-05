import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeCallbackUrl } from "@/features/auth/callback-url";
import { AuthCard } from "@/features/auth/components/auth-card";
import { GoogleButton } from "@/features/auth/components/google-button";
import { SignupForm } from "@/features/auth/components/signup-form";
import { auth, isGoogleEnabled } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const next = safeCallbackUrl((await searchParams).callbackUrl);
  if (await auth()) redirect(next);

  const loginHref = next === "/" ? "/login" : `/login?callbackUrl=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Create an account"
      description="Share your recipes and use the cooking assistant."
      footer={
        <p>
          Already have an account?{" "}
          <Link href={loginHref} className="font-medium text-primary underline underline-offset-4">
            Log in
          </Link>
        </p>
      }
    >
      {isGoogleEnabled() && <GoogleButton callbackUrl={next} />}
      <SignupForm callbackUrl={next} />
      <p className="text-sm text-muted-foreground">
        Your recipes and name are public; your email is not. See{" "}
        <Link href="/privacy" className="font-medium text-primary underline underline-offset-4">
          how we handle your data
        </Link>
        .
      </p>
    </AuthCard>
  );
}
