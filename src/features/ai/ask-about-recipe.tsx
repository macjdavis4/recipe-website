import Link from "next/link";
import { ChatPanel } from "./chat-panel";

type Props = { recipeId: string; slug: string; signedIn: boolean };

export function AskAboutRecipe({ recipeId, slug, signedIn }: Props) {
  return (
    <section
      aria-labelledby="ask-title"
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 sm:p-6"
    >
      <div>
        <h2 id="ask-title" className="text-2xl font-semibold">
          Ask about this recipe
        </h2>
        <p className="text-sm text-muted-foreground">
          The assistant can see this recipe&apos;s ingredients and steps.
        </p>
      </div>
      {signedIn ? (
        <ChatPanel
          recipeId={recipeId}
          label="Your question about this recipe"
          suggestions={[
            "Can I make this ahead?",
            "What can I swap if I am missing an ingredient?",
            "How do I halve this?",
          ]}
        />
      ) : (
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(`/recipes/${slug}`)}`}
          className="inline-flex min-h-11 items-center self-start font-medium text-primary underline"
        >
          Log in to ask the assistant
        </Link>
      )}
    </section>
  );
}
