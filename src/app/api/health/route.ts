import { connection } from "next/server";
import { getDb } from "@/lib/db";
import { errorSummary } from "@/lib/log";

/**
 * Uptime check: 200 when the database answers within 5 seconds, else 503.
 * Reveals nothing about configuration.
 */
export async function GET(): Promise<Response> {
  // Must run per request: without this the handler is prerendered at build time.
  await connection();
  const started = Date.now();
  try {
    const db = await getDb();
    await Promise.race([
      db.query(`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("database timeout")), 5000)),
    ]);
    return Response.json({ ok: true, ms: Date.now() - started }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("health check failed", errorSummary(err));
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
