import { z } from "zod";
import { approveTitle, rejectTitle, removeTitle } from "@/lib/admin";
import { requireAdmin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { getPaymentProvider } from "@/lib/payments/index";

const Body = z.object({
  reason: z.string().trim().max(500).optional().default(""),
  refund: z.boolean().optional().default(true),
});

/** POST /api/admin/titles/[id]/approve | reject | remove */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; action: string }> }): Promise<Response> {
  const denied = requireAdmin(request);
  if (denied) return denied;
  const { id, action } = await params;
  const body = Body.safeParse(await request.json().catch(() => ({})));
  if (!body.success) return Response.json({ error: "Bad request." }, { status: 400 });

  try {
    const db = await getDb();
    let result;
    if (action === "approve") {
      result = await approveTitle(db, id);
    } else if (action === "reject" || action === "remove") {
      if (!body.data.reason) return Response.json({ error: "Give a reason." }, { status: 400 });
      const provider = await getPaymentProvider();
      result =
        action === "reject"
          ? await rejectTitle(db, provider, id, body.data.reason)
          : await removeTitle(db, provider, id, body.data.reason, body.data.refund);
    } else {
      return Response.json({ error: "Unknown action." }, { status: 404 });
    }
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
    return Response.json({ ok: true });
  } catch (err) {
    console.error(`admin ${action} failed`, err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
