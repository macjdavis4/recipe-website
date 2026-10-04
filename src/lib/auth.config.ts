import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config shared with middleware. No Prisma, bcrypt, or
// providers here. Pages still check the session on the server; this only
// handles redirects.

const PROTECTED_PATHS = [
  /^\/recipes\/new\/?$/,
  /^\/recipes\/[^/]+\/edit\/?$/,
  /^\/assistant(\/|$)/,
];
const AUTH_PAGES = ["/login", "/signup"];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATHS.some((pattern) => pattern.test(pathname));
}

export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  // Caddy terminates TLS and forwards the Host header.
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const signedIn = Boolean(auth?.user);

      if (AUTH_PAGES.includes(nextUrl.pathname)) {
        return signedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      }

      if (isProtectedPath(nextUrl.pathname) && !signedIn) {
        const login = new URL("/login", nextUrl);
        login.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
        return Response.redirect(login);
      }

      return true;
    },
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
