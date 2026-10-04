import { aiErrorResponse, jsonError } from "@/features/ai/http";
import { assertWithinAiLimit, recordAiUsage } from "@/features/ai/rate-limit";
import {
  pantryIdeasSchema,
  pantryIdeasShape,
  pantryRequestSchema,
} from "@/features/pantry/schemas";
import { AIOutputError, getAIProvider } from "@/lib/ai";
import { PANTRY_SYSTEM_PROMPT, pantryPrompt } from "@/lib/ai/prompts";
import { auth } from "@/lib/auth";

const MAX_TOKENS = 8192;
const ATTEMPTS = 2; // one retry when the model's output fails validation

/** Returns up to 3 validated recipe ideas as JSON. Not streamed, so a 429 is a real status. */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return jsonError(401, "Log in to get AI recipe ideas.");
  const userId = session.user.id;

  try {
    await assertWithinAiLimit(userId);

    const parsed = pantryRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request.");

    const provider = getAIProvider();
    await recordAiUsage(userId, "PANTRY");

    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      try {
        const raw = await provider.generateObject({
          system: PANTRY_SYSTEM_PROMPT,
          prompt: pantryPrompt(parsed.data.items),
          schema: pantryIdeasShape,
          maxTokens: MAX_TOKENS,
          signal: request.signal,
        });
        const ideas = pantryIdeasSchema.safeParse(raw);
        if (ideas.success)
          return Response.json(ideas.data, { headers: { "Cache-Control": "no-store" } });
        console.warn(
          `Pantry ideas failed validation (attempt ${attempt})`,
          ideas.error.issues.slice(0, 3),
        );
      } catch (error) {
        if (!(error instanceof AIOutputError)) throw error;
      }
    }
    return jsonError(502, "We could not come up with ideas this time. Try again.");
  } catch (error) {
    return aiErrorResponse(error);
  }
}
