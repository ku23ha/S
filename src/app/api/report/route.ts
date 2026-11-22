import { getDb } from "@/lib/db";
import { LIMITS, limitRequest } from "@/lib/ratelimit";
import { ReportInput, submitReport } from "@/lib/reports";

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = ReportInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400 });
  }
  try {
    const db = await getDb();
    const limited = await limitRequest(db, LIMITS.report, request);
    if (limited) return limited;
    const result = await submitReport(db, parsed.data);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("report failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
