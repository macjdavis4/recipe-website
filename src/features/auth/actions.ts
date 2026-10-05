"use server";

import { Prisma } from "@prisma/client";
import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { signIn, signOut } from "@/lib/auth";
import { db } from "@/lib/db";
import { getEmailSender } from "@/lib/email";
import { safeCallbackUrl } from "./callback-url";
import { clientIp } from "./client-ip";
import { allowResetRequest, allowSignup } from "./login-rate-limit";
import { RESET_UNAVAILABLE } from "./messages";
import { hashPassword } from "./password";
import { resetPassword, sendPasswordResetEmail } from "./password-reset";
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from "./schemas";

export type AuthActionResult = {
  ok: false;
  message?: string;
  fieldErrors?: Partial<Record<"name" | "email" | "password" | "confirmPassword", string>>;
};

const GENERIC_LOGIN_ERROR = "Email or password is incorrect.";
const RATE_LIMIT_ERROR = "Too many attempts. Wait 15 minutes and try again.";
const EMAIL_TAKEN = "An account with this email already exists. Try logging in.";

function firstFieldErrors(error: z.ZodError): AuthActionResult["fieldErrors"] {
  const { fieldErrors } = z.flattenError(error);
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([key, messages]) => [key, (messages as string[])[0]]),
  );
}

async function signInWithPassword(email: string, password: string, callbackUrl: unknown) {
  try {
    // Throws a redirect on success, which Next.js turns into navigation.
    await signIn("credentials", { email, password, redirectTo: safeCallbackUrl(callbackUrl) });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === "rate_limited") {
      return { ok: false, message: RATE_LIMIT_ERROR } as const;
    }
    if (error instanceof AuthError) return { ok: false, message: GENERIC_LOGIN_ERROR } as const;
    throw error;
  }
  return { ok: false } as const;
}

export async function loginAction(
  values: unknown,
  callbackUrl?: unknown,
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse(values);
  if (!parsed.success) return { ok: false, message: GENERIC_LOGIN_ERROR };
  return signInWithPassword(parsed.data.email, parsed.data.password, callbackUrl);
}

export async function signupAction(
  values: unknown,
  callbackUrl?: unknown,
): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  const { name, email, password } = parsed.data;

  if (!(await allowSignup(clientIp(await headers())))) {
    return { ok: false, message: "Too many new accounts from this network. Try again in an hour." };
  }

  try {
    await db.user.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, fieldErrors: { email: EMAIL_TAKEN } };
    }
    throw error;
  }

  return signInWithPassword(email, password, callbackUrl);
}

export async function googleSignInAction(callbackUrl?: unknown): Promise<void> {
  await signIn("google", { redirectTo: safeCallbackUrl(callbackUrl) });
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/**
 * Always answers the same way whether or not the account exists, and sends the
 * email after responding, so neither the message nor the timing reveals who
 * has an account.
 */
export async function forgotPasswordAction(
  values: unknown,
): Promise<{ ok: true } | AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };
  if (!getEmailSender()) return { ok: false, message: RESET_UNAVAILABLE };

  const { email } = parsed.data;
  if (!(await allowResetRequest(email, clientIp(await headers())))) {
    return { ok: false, message: "Too many reset requests. Try again in an hour." };
  }

  after(() =>
    sendPasswordResetEmail(email).catch((error) =>
      console.error("Failed to send password reset email", error),
    ),
  );
  return { ok: true };
}

export async function resetPasswordAction(values: unknown): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse(values);
  if (!parsed.success) return { ok: false, fieldErrors: firstFieldErrors(parsed.error) };

  if (!(await resetPassword(parsed.data.token, parsed.data.password))) {
    return {
      ok: false,
      message: "This reset link has expired or was already used. Request a new one.",
    };
  }
  redirect("/login?reset=1");
}
