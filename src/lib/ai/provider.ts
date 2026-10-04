import "server-only";
import type { z } from "zod";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type StreamTextArgs = {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
  signal?: AbortSignal;
};

export type GenerateObjectArgs<T extends z.ZodType> = {
  system: string;
  prompt: string;
  /** Shape the model is asked to produce. Callers still validate the result. */
  schema: T;
  maxTokens: number;
  signal?: AbortSignal;
};

/** The only way app code talks to a model. Swappable for the mock in tests. */
export interface AIProvider {
  readonly name: string;
  streamText(args: StreamTextArgs): AsyncIterable<string>;
  generateObject<T extends z.ZodType>(args: GenerateObjectArgs<T>): Promise<unknown>;
}

/** The model declined (stop_reason "refusal"). */
export class AIRefusalError extends Error {
  constructor() {
    super("The assistant declined to answer that.");
    this.name = "AIRefusalError";
  }
}

/** The model returned output we could not use (bad JSON, truncated, wrong shape). */
export class AIOutputError extends Error {
  constructor(message = "The assistant returned an unexpected response.") {
    super(message);
    this.name = "AIOutputError";
  }
}

/** AI is not configured (e.g. no API key). */
export class AIUnavailableError extends Error {
  constructor(message = "The assistant is not available right now.") {
    super(message);
    this.name = "AIUnavailableError";
  }
}
