import { dailyStats } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

export async function GET(request: Request): Promise<Response> {
  const denied = requireAdmin(request, { mutating: false });
  if (denied) return denied;
  const days = Math.min(Math.max(Number(new URL(request.url).searchParams.get("days")) || 14, 1), 90);
  try {
    return Response.json({ days: await dailyStats(await getDb(), days) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("admin stats failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
