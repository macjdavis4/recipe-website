/**
 * Client IP as seen by our reverse proxy. Caddy is the only proxy in front of
 * the app, and it appends the connecting address to X-Forwarded-For, so the
 * last entry is the one we can trust. Earlier entries are client-supplied.
 */
export function clientIp(headers: Headers): string | null {
  const hops = headers.get("x-forwarded-for")?.split(",") ?? [];
  const last = hops.at(-1)?.trim();
  return last || headers.get("x-real-ip")?.trim() || null;
}
