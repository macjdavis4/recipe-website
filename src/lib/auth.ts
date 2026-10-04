import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { clientIp } from "@/features/auth/client-ip";
import { verifyCredentials } from "@/features/auth/credentials";
import { authConfig } from "./auth.config";
import { db } from "./db";
import { getEnv } from "./env";

export function isGoogleEnabled(): boolean {
  return Boolean(getEnv().GOOGLE_CLIENT_ID);
}

// Lazy config so env is read per request, not at build time.
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const env = getEnv();

  return {
    ...authConfig,
    adapter: PrismaAdapter(db),
    providers: [
      Credentials({
        credentials: { email: {}, password: {} },
        authorize: (credentials, request) =>
          verifyCredentials(credentials, clientIp(request.headers)),
      }),
      ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? [Google({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET })]
        : []),
    ],
  };
});
