import { aiErrorResponse, jsonError, midStreamMessage } from "@/features/ai/http";
import { assertWithinAiLimit, recordAiUsage } from "@/features/ai/rate-limit";
import { chatRequestSchema } from "@/features/ai/schemas";
import { getAIProvider } from "@/lib/ai";
import { CHAT_SYSTEM_PROMPT, recipeContext } from "@/lib/ai/prompts";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const MAX_TOKENS = 2048;

async function buildSystemPrompt(recipeId: string | undefined): Promise<string> {
  if (!recipeId) return CHAT_SYSTEM_PROMPT;
  // Loaded from the database by id; recipe text is never taken from the client.
  const recipe = await db.recipe.findUnique({
    where: { id: recipeId },
    select: {
      title: true,
      servings: true,
      prepMinutes: true,
      cookMinutes: true,
      ingredients: { orderBy: { position: "asc" } },
      steps: { orderBy: { position: "asc" }, select: { text: true } },
    },
  });
  return recipe ? `${CHAT_SYSTEM_PROMPT}\n\n${recipeContext(recipe)}` : CHAT_SYSTEM_PROMPT;
}

/** Streams a plain-text (Markdown) answer. Order: auth, rate limit, validation, usage log, model. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return jsonError(401, "Log in to use the assistant.");
  const userId = session.user.id;

  try {
    await assertWithinAiLimit(userId);

    const parsed = chatRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request.");

    const system = await buildSystemPrompt(parsed.data.recipeId);
    const provider = getAIProvider();
    await recordAiUsage(userId, "CHAT");

    const chunks = provider
      .streamText({
        system,
        messages: parsed.data.messages,
        maxTokens: MAX_TOKENS,
        signal: request.signal,
      })
      [Symbol.asyncIterator]();
    // Wait for the first chunk so failures before any output get a real status code.
    const first = await chunks.next();

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (first.done) controller.close();
        else controller.enqueue(encoder.encode(first.value));
      },
      async pull(controller) {
        try {
          const next = await chunks.next();
          if (next.done) controller.close();
          else controller.enqueue(encoder.encode(next.value));
        } catch (error) {
          controller.enqueue(encoder.encode(midStreamMessage(error)));
          controller.close();
        }
      },
      async cancel() {
        await chunks.return?.();
      },
    });

    return new Response(body, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return aiErrorResponse(error);
  }
}
