import "server-only";
import { AIOutputError, AIRefusalError, AIUnavailableError, isUpstreamError } from "@/lib/ai";
import { HttpError } from "@/lib/errors";
import { AiRateLimitError } from "./rate-limit";

export const REFUSAL_MESSAGE = "I can't help with that one. Try another cooking question.";
export const CUT_OFF_MESSAGE = "\n\n_The answer was cut off. Please try again._";

export function jsonError(status: number, message: string, headers?: HeadersInit): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store", ...headers } },
  );
}

/** Maps errors from AI routes to friendly JSON responses. Unknown errors are logged and hidden. */
export function aiErrorResponse(error: unknown): Response {
  if (error instanceof AiRateLimitError) {
    return jsonError(429, error.message, { "Retry-After": String(error.retryAfterSeconds) });
  }
  if (error instanceof HttpError) return jsonError(error.status, error.message);
  if (error instanceof AIRefusalError) return jsonError(422, REFUSAL_MESSAGE);
  if (error instanceof AIUnavailableError) return jsonError(503, error.message);
  if (error instanceof AIOutputError)
    return jsonError(502, "The assistant had trouble with that. Try again.");
  if (isUpstreamError(error)) {
    console.error("AI provider error", error);
    return jsonError(503, "The assistant is busy right now. Try again in a moment.");
  }
  console.error("Unexpected AI route error", error);
  return jsonError(500, "Something went wrong. Try again.");
}

/** Text to append when a stream fails after it has started. */
export function midStreamMessage(error: unknown): string {
  if (error instanceof AIRefusalError) return `\n\n_${REFUSAL_MESSAGE}_`;
  console.error("AI stream failed mid-answer", error);
  return CUT_OFF_MESSAGE;
}
