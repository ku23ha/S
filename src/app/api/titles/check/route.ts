import { z } from "zod";
import { checkTitle } from "@/lib/check";
import { getDb } from "@/lib/db";

const Query = z.object({ q: z.string().max(200) });

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = Query.safeParse({ q: url.searchParams.get("q") ?? "" });
  if (!parsed.success) {
    return Response.json({ error: "Search for a title of up to 40 characters." }, { status: 400 });
  }

  try {
    const db = await getDb();
    const result = await checkTitle(db, parsed.data.q);
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("titles/check failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
