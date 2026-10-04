"use client";

import { useCallback, useRef, useState } from "react";
import { CHAT_LIMITS } from "./schemas";

export type Message = { role: "user" | "assistant"; content: string };
type Status = "idle" | "streaming";

/** Sends the conversation to /api/ai/chat and streams the answer into state. */
export function useChat(recipeId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>();
  const controller = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      const question = text.trim();
      if (!question || status === "streaming") return false;
      setError(undefined);

      const history: Message[] = [...messages, { role: "user", content: question }];
      // Send at most the last 20 messages, starting from a user message.
      let recent = history.slice(-CHAT_LIMITS.messages);
      while (recent[0]?.role !== "user") recent = recent.slice(1);

      setMessages([...history, { role: "assistant", content: "" }]);
      setStatus("streaming");
      controller.current = new AbortController();
      let answer = "";

      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: recent, recipeId }),
          signal: controller.current.signal,
        });
        if (!res.ok || !res.body) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Something went wrong. Try again.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          answer += decoder.decode(value, { stream: true });
          setMessages([...history, { role: "assistant", content: answer }]);
        }
        return true;
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          // Keep whatever arrived before Stop was pressed.
          setMessages(
            answer ? [...history, { role: "assistant", content: answer }] : history.slice(0, -1),
          );
          return true;
        }
        // Drop the unanswered question so it can be retried from the input.
        setMessages(messages);
        setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
        return false;
      } finally {
        setStatus("idle");
        controller.current = null;
      }
    },
    [messages, recipeId, status],
  );

  const stop = useCallback(() => controller.current?.abort(), []);
  const reset = useCallback(() => {
    controller.current?.abort();
    setMessages([]);
    setError(undefined);
  }, []);

  return { messages, status, error, send, stop, reset };
}
