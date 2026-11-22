import { createHash } from "node:crypto";
import { decodeSlug } from "@/lib/cert-routes";
import { getDb } from "@/lib/db";
import { LIMITS, clientIp, limitRequest } from "@/lib/ratelimit";

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|discord|slack|linkedin|embedly|headless/i;

/**
 * Count one unique outside view of a certificate per viewer per day.
 * The viewer hash is a salted SHA-256 of IP, user agent and the date, so
 * it changes daily and the raw values are never stored.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const ua = request.headers.get("user-agent") ?? "";
  let owner = false;
  try {
    const body = (await request.json()) as { owner?: unknown };
    owner = body.owner === true;
  } catch {
    // No body: count as an outside view.
  }
  if (owner || BOT_UA.test(ua)) return new Response(null, { status: 204 });

  try {
    const db = await getDb();
    const limited = await limitRequest(db, LIMITS.view, request);
    if (limited) return limited;
    const { slug } = await params;
    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.VIEWER_HASH_SALT ?? process.env.SESSION_SECRET ?? "dev-salt";
    const viewerHash = createHash("sha256").update(`${salt}|${day}|${clientIp(request)}|${ua}`).digest("base64url");
    await db.query(
      `insert into certificate_views (title_id, viewer_hash, day)
       select id, $2, $3::date from titles where slug = $1 and status = 'claimed'
       on conflict do nothing`,
      [decodeSlug(slug), viewerHash, day],
    );
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("view count failed", err instanceof Error ? err.message : err);
    return new Response(null, { status: 204 });
  }
}
