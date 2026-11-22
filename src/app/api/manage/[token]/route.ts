import { ManageInput } from "@/lib/claim";
import { getDb } from "@/lib/db";
import { applyManageEdit } from "@/lib/manage";
import { LIMITS, limitRequest } from "@/lib/ratelimit";
import { errorSummary } from "@/lib/log";

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }): Promise<Response> {
  const { token } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Bad request." }, { status: 400 });
  }
  const parsed = ManageInput.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form and try again." }, { status: 400 });
  }
  try {
    const db = await getDb();
    const limited = await limitRequest(db, LIMITS.manage, request);
    if (limited) return limited;
    const result = await applyManageEdit(db, token, parsed.data);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ status: result.status });
  } catch (err) {
    console.error("manage edit failed", errorSummary(err));
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
