"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import { FormAlert } from "@/components/form/form-alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { AiMarkdown } from "./markdown";
import { CHAT_LIMITS } from "./schemas";
import { useChat } from "./use-chat";

type Props = { recipeId?: string; suggestions: string[]; label?: string };

export function ChatPanel({ recipeId, suggestions, label = "Your question" }: Props) {
  const { messages, status, error, send, stop, reset } = useChat(recipeId);
  const [input, setInput] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const inputId = useId();
  const endRef = useRef<HTMLDivElement>(null);
  const streaming = status === "streaming";
  const remaining = CHAT_LIMITS.messageChars - input.length;

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  async function submit(text = input) {
    setAnnouncement("");
    const previous = input;
    setInput("");
    const ok = await send(text);
    if (ok) setAnnouncement("The assistant answered.");
    else setInput(previous || text);
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Try asking:</p>
          <ul className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s}>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto min-h-11 text-left whitespace-normal"
                  onClick={() => submit(s)}
                >
                  {s}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Conversation" aria-busy={streaming}>
          {messages.map((m, i) => (
            <li
              key={i}
              className={cn(
                "max-w-[90%] rounded-xl px-4 py-3",
                m.role === "user"
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start border bg-card",
              )}
            >
              <span className="sr-only">{m.role === "user" ? "You said:" : "Assistant:"}</span>
              {m.role === "user" ? (
                <p className="whitespace-pre-wrap">{m.content}</p>
              ) : m.content ? (
                <AiMarkdown>{m.content}</AiMarkdown>
              ) : (
                <p className="text-muted-foreground">Thinking...</p>
              )}
            </li>
          ))}
        </ol>
      )}
      <div ref={endRef} />
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <FormAlert message={error} />

      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Label htmlFor={inputId}>{label}</Label>
        <Textarea
          id={inputId}
          value={input}
          maxLength={CHAT_LIMITS.messageChars}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          aria-describedby={`${inputId}-count`}
          placeholder="Ask about swaps, timing, or technique"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={`${inputId}-count`} className="text-xs text-muted-foreground">
            {remaining < 200
              ? `${remaining} characters left`
              : "Press Enter to send, Shift+Enter for a new line."}
          </p>
          <div className="flex gap-2">
            {messages.length > 0 && !streaming && (
              <Button type="button" variant="ghost" onClick={reset}>
                Clear
              </Button>
            )}
            {streaming ? (
              <Button type="button" variant="outline" onClick={stop}>
                <Square aria-hidden="true" />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                <Send aria-hidden="true" />
                Ask
              </Button>
            )}
          </div>
        </div>
      </form>
      <p className="text-xs text-muted-foreground">
        AI answers can be wrong. Check food safety advice.
      </p>
    </div>
  );
}
