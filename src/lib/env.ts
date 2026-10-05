import "server-only";
import { z } from "zod";

// Treat blank values (e.g. GOOGLE_CLIENT_ID="") as unset.
const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  );

export const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.url({
      protocol: /^postgres(ql)?$/,
      error: "DATABASE_URL must be a postgres URL",
    }),

    AUTH_SECRET: optional(z.string().min(32, "AUTH_SECRET must be at least 32 characters")),
    AUTH_URL: optional(z.url()),
    GOOGLE_CLIENT_ID: optional(z.string()),
    GOOGLE_CLIENT_SECRET: optional(z.string()),

    AI_PROVIDER: optional(z.enum(["anthropic", "mock"])),
    ANTHROPIC_API_KEY: optional(z.string()),
    AI_MODEL: z.string().min(1).default("claude-haiku-4-5-20251001"),
    AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().positive().default(30),

    STORAGE_DRIVER: z.enum(["local", "spaces"]).default("local"),
    SPACES_KEY: optional(z.string()),
    SPACES_SECRET: optional(z.string()),
    SPACES_REGION: optional(z.string()),
    SPACES_ENDPOINT: optional(z.url()),
    SPACES_BUCKET: optional(z.string()),
    SPACES_CDN_URL: optional(z.url()),

    EMAIL_PROVIDER: optional(z.enum(["resend", "log"])),
    RESEND_API_KEY: optional(z.string()),
    EMAIL_FROM: optional(z.string()),
  })
  .superRefine((env, ctx) => {
    const require = (key: keyof typeof env, reason: string) => {
      if (!env[key])
        ctx.addIssue({ code: "custom", path: [key], message: `${key} is required ${reason}` });
    };

    if (env.NODE_ENV === "production") require("AUTH_SECRET", "in production");

    if (env.GOOGLE_CLIENT_ID) require("GOOGLE_CLIENT_SECRET", "when GOOGLE_CLIENT_ID is set");

    const aiProvider = env.AI_PROVIDER ?? (env.NODE_ENV === "test" ? "mock" : "anthropic");
    if (env.NODE_ENV === "production" && aiProvider === "anthropic") {
      require("ANTHROPIC_API_KEY", "in production unless AI_PROVIDER=mock");
    }

    if (emailProvider(env) === "resend") {
      require("RESEND_API_KEY", "when EMAIL_PROVIDER=resend");
      require("EMAIL_FROM", "when sending email with Resend");
    }

    if (env.STORAGE_DRIVER === "spaces") {
      for (const key of [
        "SPACES_KEY",
        "SPACES_SECRET",
        "SPACES_REGION",
        "SPACES_ENDPOINT",
        "SPACES_BUCKET",
        "SPACES_CDN_URL",
      ] as const) {
        require(key, "when STORAGE_DRIVER=spaces");
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

type EmailSettings = Pick<Env, "NODE_ENV" | "EMAIL_PROVIDER" | "RESEND_API_KEY">;

/**
 * How email is sent: Resend when it has a key, the server log in dev and
 * tests, and not at all in production without a key (password reset is then
 * switched off rather than printing reset links to the log).
 */
export function emailProvider(env: EmailSettings): "resend" | "log" | null {
  if (env.EMAIL_PROVIDER) return env.EMAIL_PROVIDER;
  if (env.RESEND_API_KEY) return "resend";
  return env.NODE_ENV === "production" ? null : "log";
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    // List variable names and reasons only. Never echo values, which may be secrets.
    const problems = result.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment variables:\n${problems.join("\n")}`);
  }
  return result.data;
}

let cached: Env | undefined;

/**
 * Validated server environment. Parsed lazily on first use so `next build`
 * can run without runtime secrets present.
 */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
