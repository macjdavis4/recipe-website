import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

// Only run on pages that redirect based on the session. Keep in sync with
// PROTECTED_PATHS in auth.config.ts.
export const config = {
  matcher: ["/recipes/new", "/recipes/:slug/edit", "/assistant/:path*", "/admin/:path*"],
};
