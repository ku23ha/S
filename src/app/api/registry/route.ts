import { z } from "zod";
import { getDb } from "@/lib/db";
import { listRegistry } from "@/lib/queries";
import { toRegistryCard } from "@/lib/format";
import { normalizeTitleKey } from "@/lib/titles";

const Query = z.object({
  tab: z.enum(["recent", "lowest"]).default("recent"),
  cursor: z.string().max(100).optional(),
  q: z.string().max(200).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  const parsed = Query.safeParse({
    tab: sp.get("tab") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
    q: sp.get("q") ?? undefined,
  });
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });

  try {
    const db = await getDb();
    const q = parsed.data.q ? normalizeTitleKey(parsed.data.q) : null;
    const page = await listRegistry(db, { tab: parsed.data.tab, cursor: parsed.data.cursor, q: q || null });
    return Response.json(
      { items: page.items.map(toRegistryCard), nextCursor: page.nextCursor },
      { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=30" } },
    );
  } catch (err) {
    console.error("registry failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
