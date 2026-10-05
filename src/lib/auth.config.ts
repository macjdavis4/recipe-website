import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config shared with middleware. No Prisma, bcrypt, or
// providers here. Pages still check the session on the server; this only
// handles redirects.

const PROTECTED_PATHS = [
  /^\/recipes\/new\/?$/,
  /^\/recipes\/[^/]+\/edit\/?$/,
  /^\/assistant(\/|$)/,
  /^\/admin(\/|$)/,
];

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

      // Login and signup are not handled here: the edge cannot tell that a
      // session was ended by a password reset, and would bounce that user
      // away from the login page. Those pages check the session themselves.
      if (isProtectedPath(nextUrl.pathname) && !signedIn) {
        const login = new URL("/login", nextUrl);
        login.searchParams.set("callbackUrl", `${nextUrl.pathname}${nextUrl.search}`);
        return Response.redirect(login);
      }

      return true;
    },
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
        token.authAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
