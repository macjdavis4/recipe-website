import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AIOutputError, AIRefusalError, type AIProvider } from "./provider";

/** True for errors from the Anthropic API itself (auth, rate limits, overload, outages). */
export function isUpstreamError(error: unknown): boolean {
  return error instanceof Anthropic.APIError;
}

/**
 * Anthropic-backed provider. The model comes from AI_MODEL, so this sends no
 * model-specific options (thinking, effort) and works across Claude models.
 */
export function createAnthropicProvider({
  apiKey,
  model,
}: {
  apiKey: string;
  model: string;
}): AIProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: "anthropic",

    async *streamText({ system, messages, maxTokens, signal }) {
      const stream = client.messages.stream(
        { model, max_tokens: maxTokens, system, messages },
        { signal },
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
      const final = await stream.finalMessage();
      if (final.stop_reason === "refusal") throw new AIRefusalError();
    },

    async generateObject({ system, prompt, schema, maxTokens, signal }) {
      let response;
      try {
        response = await client.messages.parse(
          {
            model,
            max_tokens: maxTokens,
            system,
            messages: [{ role: "user", content: prompt }],
            output_config: { format: zodOutputFormat(schema) },
          },
          { signal },
        );
      } catch (error) {
        // API errors (auth, rate limit, outages) propagate; parse failures become output errors.
        if (error instanceof Anthropic.APIError) throw error;
        throw new AIOutputError();
      }
      if (response.stop_reason === "refusal") throw new AIRefusalError();
      if (response.stop_reason === "max_tokens" || response.parsed_output == null) {
        throw new AIOutputError();
      }
      return response.parsed_output;
    },
  };
}
