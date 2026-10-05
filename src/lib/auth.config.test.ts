import type { Session } from "next-auth";
import { describe, expect, it } from "vitest";
import { authConfig, isProtectedPath } from "./auth.config";

describe("isProtectedPath", () => {
  it.each(["/recipes/new", "/recipes/pancakes/edit", "/assistant", "/assistant/chat"])(
    "protects %s",
    (path) => expect(isProtectedPath(path)).toBe(true),
  );

  it.each([
    "/",
    "/recipes",
    "/recipes/pancakes",
    "/recipes/newt",
    "/u/abc",
    "/pantry",
    "/assistants",
  ])("leaves %s public", (path) => expect(isProtectedPath(path)).toBe(false));
});

describe("authorized callback", () => {
  const user: Session = { user: { id: "u1" }, expires: "2099-01-01" };
  const run = (path: string, auth: Session | null) =>
    authConfig.callbacks.authorized({
      auth,
      request: { nextUrl: new URL(`http://localhost${path}`) },
    } as never);

  it("redirects guests on protected pages to login with a relative callbackUrl", () => {
    const res = run("/recipes/new?from=home", null) as Response;
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("callbackUrl")).toBe("/recipes/new?from=home");
  });

  it("lets signed-in users through protected pages", () => {
    expect(run("/recipes/new", user)).toBe(true);
  });

  it("leaves login and signup to the pages, which check the session in the database", () => {
    expect(run("/login", user)).toBe(true);
    expect(run("/signup", null)).toBe(true);
  });

  it("allows guests on public pages", () => {
    expect(run("/recipes/pancakes", null)).toBe(true);
  });
});
