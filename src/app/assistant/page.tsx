import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatPanel } from "@/features/ai/chat-panel";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "Cooking assistant" };

export default async function AssistantPage() {
  // Middleware redirects guests too; this is the server-side guarantee.
  if (!(await auth())?.user) redirect("/login?callbackUrl=%2Fassistant");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold md:text-4xl">Cooking assistant</h1>
        <p className="text-muted-foreground">
          Ask about techniques, swaps, timing, and food safety.
        </p>
      </header>
      <ChatPanel
        suggestions={[
          "What can I use instead of buttermilk?",
          "How do I know when chicken is cooked through?",
          "Why did my bread come out dense?",
        ]}
      />
    </div>
  );
}
