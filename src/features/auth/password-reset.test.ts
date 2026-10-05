import { beforeEach, describe, expect, it, vi } from "vitest";

type Token = { id: string; userId: string; tokenHash: string; expiresAt: Date };
type User = { id: string; name: string | null; email: string; passwordHash: string | null };

const state = vi.hoisted(() => ({
  users: [] as User[],
  tokens: [] as Token[],
  changedAt: new Map<string, Date>(),
  verifiedAt: new Map<string, Date>(),
  sent: [] as { to: string; subject: string; text: string; html: string }[],
  emailOn: true,
  cleared: [] as string[],
}));

const matches = (t: Token, where: Record<string, unknown>): boolean => {
  if (Array.isArray(where.OR)) return where.OR.some((w) => matches(t, w));
  if (where.id !== undefined && t.id !== where.id) return false;
  if (where.userId !== undefined && t.userId !== where.userId) return false;
  const lt = (where.expiresAt as { lt?: Date } | undefined)?.lt;
  return !lt || t.expiresAt < lt;
};

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        state.users.find((u) => u.email === where.email) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<User> & { passwordChangedAt: Date; emailVerified: Date };
      }) => {
        const user = state.users.find((u) => u.id === where.id)!;
        user.passwordHash = data.passwordHash ?? null;
        state.changedAt.set(user.id, data.passwordChangedAt);
        state.verifiedAt.set(user.id, data.emailVerified);
      },
    },
    passwordResetToken: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const t = state.tokens.find((x) => x.tokenHash === where.tokenHash);
        if (!t) return null;
        return { ...t, user: { email: state.users.find((u) => u.id === t.userId)!.email } };
      },
      create: async ({ data }: { data: Omit<Token, "id"> }) => {
        state.tokens.push({ id: crypto.randomUUID(), ...data });
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const before = state.tokens.length;
        state.tokens = state.tokens.filter((t) => !matches(t, where));
        return { count: before - state.tokens.length };
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  },
}));
vi.mock("@/lib/email", () => ({
  getEmailSender: () =>
    state.emailOn ? { send: async (m: (typeof state.sent)[0]) => void state.sent.push(m) } : null,
}));
vi.mock("@/lib/env", () => ({ getEnv: () => ({ AUTH_URL: "https://cook.example.com/" }) }));
vi.mock("./password", () => ({ hashPassword: async (p: string) => `hashed:${p}` }));
vi.mock("./login-rate-limit", () => ({
  clearLoginFailures: async (email: string) => void state.cleared.push(email),
}));

const { hashResetToken, resetPassword, sendPasswordResetEmail, RESET_TTL_MS } =
  await import("./password-reset");

const linkToken = (text: string) => /reset-password\?token=([\w-]+)/.exec(text)![1];

beforeEach(() => {
  state.users = [{ id: "u1", name: "Ada", email: "ada@example.com", passwordHash: "hashed:old" }];
  state.tokens = [];
  state.changedAt.clear();
  state.verifiedAt.clear();
  state.sent = [];
  state.emailOn = true;
  state.cleared = [];
});

describe("sendPasswordResetEmail", () => {
  it("emails a link on the configured site and stores only the token's hash", async () => {
    await sendPasswordResetEmail("ada@example.com");

    expect(state.sent).toHaveLength(1);
    const [email] = state.sent;
    expect(email.to).toBe("ada@example.com");
    expect(email.text).toContain("https://cook.example.com/reset-password?token=");
    const token = linkToken(email.text);
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0].tokenHash).toBe(hashResetToken(token));
    expect(state.tokens[0].tokenHash).not.toContain(token);
    const ttl = state.tokens[0].expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(RESET_TTL_MS - 5_000);
    expect(ttl).toBeLessThanOrEqual(RESET_TTL_MS);
  });

  it("sends nothing for an unknown email or when email is off", async () => {
    await sendPasswordResetEmail("nobody@example.com");
    state.emailOn = false;
    await sendPasswordResetEmail("ada@example.com");
    expect(state.sent).toHaveLength(0);
    expect(state.tokens).toHaveLength(0);
  });

  it("keeps only the newest link per account", async () => {
    await sendPasswordResetEmail("ada@example.com");
    await sendPasswordResetEmail("ada@example.com");
    expect(state.tokens).toHaveLength(1);
    expect(state.tokens[0].tokenHash).toBe(hashResetToken(linkToken(state.sent[1].text)));
  });

  it("escapes the user's name in the HTML email", async () => {
    state.users[0].name = "<script>x</script>";
    await sendPasswordResetEmail("ada@example.com");
    expect(state.sent[0].html).not.toContain("<script>");
    expect(state.sent[0].html).toContain("&lt;script&gt;");
  });
});

describe("resetPassword", () => {
  async function issueToken() {
    await sendPasswordResetEmail("ada@example.com");
    return linkToken(state.sent.at(-1)!.text);
  }

  it("sets the new password, records the change, and clears login failures", async () => {
    expect(await resetPassword(await issueToken(), "new password")).toBe(true);
    expect(state.users[0].passwordHash).toBe("hashed:new password");
    expect(state.changedAt.get("u1")).toBeInstanceOf(Date);
    // Following the emailed link proves the inbox, which admin access relies on.
    expect(state.verifiedAt.get("u1")).toBeInstanceOf(Date);
    expect(state.cleared).toEqual(["ada@example.com"]);
    expect(state.tokens).toHaveLength(0);
  });

  it("works only once per link", async () => {
    const token = await issueToken();
    expect(await resetPassword(token, "first new")).toBe(true);
    expect(await resetPassword(token, "second new")).toBe(false);
    expect(state.users[0].passwordHash).toBe("hashed:first new");
  });

  it("rejects unknown and expired tokens", async () => {
    expect(await resetPassword("made-up-token", "new password")).toBe(false);
    const token = await issueToken();
    state.tokens[0].expiresAt = new Date(Date.now() - 1000);
    expect(await resetPassword(token, "new password")).toBe(false);
    expect(state.users[0].passwordHash).toBe("hashed:old");
  });
});
