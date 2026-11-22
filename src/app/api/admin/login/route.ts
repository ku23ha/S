import { z } from "zod";
import { attemptLogin, sameOrigin } from "@/lib/admin-auth";
import { getDb } from "@/lib/db";
import { errorSummary } from "@/lib/log";

const Body = z.object({ password: z.string().min(1).max(200) });

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: "Bad origin." }, { status: 403 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Enter the password." }, { status: 400 });
  try {
    const result = await attemptLogin(await getDb(), request, parsed.data.password);
    if (!result.ok) {
      const headers: Record<string, string> = {};
      if (result.retryAfterSec) headers["Retry-After"] = String(result.retryAfterSec);
      return Response.json({ error: result.error }, { status: result.status, headers });
    }
    return Response.json({ ok: true }, { headers: { "Set-Cookie": result.cookie } });
  } catch (err) {
    console.error("admin login failed", errorSummary(err));
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
