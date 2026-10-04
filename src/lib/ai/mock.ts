import "server-only";
import type { AIProvider, ChatMessage } from "./provider";

/** Deterministic stand-in used in tests and when AI_PROVIDER=mock. Never calls a network. */
export function createMockProvider(): AIProvider {
  return {
    name: "mock",

    async *streamText({ messages, signal }) {
      const question = lastUserMessage(messages);
      const answer = `**Mock answer.** You asked: "${question}". Taste as you go and adjust the seasoning.`;
      for (const word of answer.split(/(?<= )/)) {
        if (signal?.aborted) return;
        yield word;
      }
    },

    async generateObject({ prompt }) {
      const have =
        prompt
          .match(/<pantry>\n([\s\S]*?)\n<\/pantry>/)?.[1]
          .split("\n")
          .filter(Boolean) ?? [];
      const main = have[0] ?? "rice";
      return {
        ideas: [
          {
            title: `Simple ${main} skillet`,
            description: `A quick one-pan dinner built around ${main}.`,
            prepMinutes: 10,
            cookMinutes: 20,
            servings: 2,
            difficulty: "EASY",
            ingredients: [
              { quantity: "2", unit: "cups", name: main },
              { quantity: "1", unit: "tbsp", name: "olive oil" },
              { quantity: "", unit: "", name: "salt" },
            ],
            steps: [
              "Heat the oil in a skillet.",
              `Add the ${main} and cook until done.`,
              "Season and serve.",
            ],
            usesFromPantry: have.slice(0, 3),
            missing: ["olive oil"],
          },
        ],
      };
    },
  };
}

function lastUserMessage(messages: ChatMessage[]): string {
  return (
    [...messages]
      .reverse()
      .find((m) => m.role === "user")
      ?.content.slice(0, 200) ?? ""
  );
}
