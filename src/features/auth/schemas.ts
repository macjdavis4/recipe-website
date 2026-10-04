import { z } from "zod";

// bcrypt ignores everything after 72 bytes, so cap the password there.
const MAX_PASSWORD_BYTES = 72;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email")
  .pipe(z.email("Enter a valid email address"));

export const loginSchema = z.object({
  email: emailSchema,
  // No length rules on login: any mismatch gets the same generic error.
  password: z.string().min(1, "Enter your password").max(200),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(80, "Use 80 characters or fewer"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Use at least 8 characters")
    .refine((p) => new TextEncoder().encode(p).length <= MAX_PASSWORD_BYTES, {
      message: "Use 72 characters or fewer",
    }),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
