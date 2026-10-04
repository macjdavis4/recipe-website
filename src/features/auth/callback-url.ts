/**
 * Only allow same-site relative paths as post-login redirects, so a crafted
 * ?callbackUrl= cannot send people to another site (open redirect).
 */
export function safeCallbackUrl(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length > 2048) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  // Reject control characters, which some browsers strip before resolving the URL.
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
