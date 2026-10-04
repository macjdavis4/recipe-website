import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 3000;

/** Liveness and readiness for Docker and the deploy workflow. Returns no secrets. */
export async function GET() {
  const version = process.env.APP_VERSION ?? "dev";
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("database timeout")), DB_TIMEOUT_MS),
      ),
    ]);
    return Response.json(
      { status: "ok", db: "ok", version },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Health check failed", error);
    return Response.json(
      { status: "error", db: "unreachable", version },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
