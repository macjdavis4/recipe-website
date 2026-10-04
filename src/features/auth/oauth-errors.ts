// Auth.js redirects back to /login?error=<type> when an OAuth sign-in fails.
export function oauthErrorMessage(error: string | undefined): string | undefined {
  if (!error) return undefined;
  if (error === "OAuthAccountNotLinked") {
    return "This email already has an account with a password. Log in with your password instead.";
  }
  return "Sign in did not work. Please try again.";
}
