export function post(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

export async function* chunks(...parts: string[]) {
  for (const part of parts) yield part;
}
