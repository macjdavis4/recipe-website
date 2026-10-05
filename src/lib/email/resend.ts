import "server-only";
import type { EmailMessage, EmailSender } from "./types";

const RESEND_URL = "https://api.resend.com/emails";

/** Sends through Resend's HTTP API. No SDK: one POST is all we need. */
export function createResendSender({
  apiKey,
  from,
}: {
  apiKey: string;
  from: string;
}): EmailSender {
  return {
    async send({ to, subject, text, html }: EmailMessage) {
      const response = await fetch(RESEND_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [to], subject, text, html }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        // Resend's error body names the problem; it never echoes the key.
        const detail = (await response.text()).slice(0, 300);
        throw new Error(`Resend rejected the email (${response.status}): ${detail}`);
      }
    },
  };
}
