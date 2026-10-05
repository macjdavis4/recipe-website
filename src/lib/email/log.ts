import "server-only";
import type { EmailMessage, EmailSender } from "./types";

/** Development stand-in: prints the email to the server log instead of sending it. */
export function createLogSender(): EmailSender {
  return {
    async send({ to, subject, text }: EmailMessage) {
      console.info(`[email] To: ${to}\n[email] Subject: ${subject}\n${text}`);
    },
  };
}
