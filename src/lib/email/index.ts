import "server-only";
import { emailProvider, getEnv } from "@/lib/env";
import { createLogSender } from "./log";
import { createResendSender } from "./resend";
import type { EmailSender } from "./types";

export type { EmailMessage, EmailSender } from "./types";

let sender: EmailSender | null | undefined;

/** The configured sender, or null when email is off (production without a Resend key). */
export function getEmailSender(): EmailSender | null {
  if (sender !== undefined) return sender;
  const env = getEnv();
  const provider = emailProvider(env);
  // env.ts guarantees the key and sender address when the provider is Resend.
  sender =
    provider === "resend"
      ? createResendSender({ apiKey: env.RESEND_API_KEY!, from: env.EMAIL_FROM! })
      : provider === "log"
        ? createLogSender()
        : null;
  return sender;
}
