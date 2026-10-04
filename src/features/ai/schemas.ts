import { z } from "zod";

export const CHAT_LIMITS = { messageChars: 2000, messages: 20 } as const;

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z
    .string()
    .trim()
    .min(1, "Type a question first.")
    .max(CHAT_LIMITS.messageChars, `Keep messages to ${CHAT_LIMITS.messageChars} characters.`),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(CHAT_LIMITS.messages, `Only the last ${CHAT_LIMITS.messages} messages can be sent.`)
    .refine((m) => m.length > 0 && m[0].role === "user" && m[m.length - 1].role === "user", {
      message: "The conversation must start and end with your message.",
    }),
  recipeId: z
    .string()
    .regex(/^[a-z0-9]{1,40}$/)
    .optional(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
