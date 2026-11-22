import { dismissReport } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const result = await dismissReport(await getDb(), id);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ ok: true });
  } catch (err) {
    console.error("admin dismiss failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
