import "server-only";
import { getEnv } from "@/lib/env";
import { createAnthropicProvider } from "./anthropic";
import { createMockProvider } from "./mock";
import { AIUnavailableError, type AIProvider } from "./provider";

export * from "./provider";
export { isUpstreamError } from "./anthropic";

let provider: AIProvider | undefined;

/**
 * Picks the provider: AI_PROVIDER when set, otherwise the mock in tests and
 * Anthropic everywhere else. Tests never reach the real API.
 */
export function getAIProvider(): AIProvider {
  if (provider) return provider;
  const env = getEnv();
  const choice = env.AI_PROVIDER ?? (env.NODE_ENV === "test" ? "mock" : "anthropic");
  if (choice === "mock") {
    provider = createMockProvider();
  } else {
    if (!env.ANTHROPIC_API_KEY) throw new AIUnavailableError("The assistant is not set up yet.");
    provider = createAnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL });
  }
  return provider;
}
