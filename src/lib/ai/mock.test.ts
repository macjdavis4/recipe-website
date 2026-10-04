import { describe, expect, it } from "vitest";
import { pantryIdeasSchema } from "@/features/pantry/schemas";
import { createMockProvider } from "./mock";
import { pantryPrompt } from "./prompts";

describe("mock provider", () => {
  it("streams a deterministic answer that echoes the question", async () => {
    let text = "";
    for await (const chunk of createMockProvider().streamText({
      system: "",
      messages: [{ role: "user", content: "How long to boil an egg?" }],
      maxTokens: 100,
    })) {
      text += chunk;
    }
    expect(text).toContain('You asked: "How long to boil an egg?"');
  });

  it("returns pantry ideas that pass strict validation", async () => {
    const output = await createMockProvider().generateObject({
      system: "",
      prompt: pantryPrompt(["egg", "rice"]),
      schema: pantryIdeasSchema,
      maxTokens: 100,
    });
    const parsed = pantryIdeasSchema.parse(output);
    expect(parsed.ideas[0].usesFromPantry).toEqual(["egg", "rice"]);
  });
});
