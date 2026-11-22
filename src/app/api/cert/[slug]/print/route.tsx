import { z } from "zod";
import { renderCertificatePng } from "@/lib/cert-image";
import { decodeSlug, toImageData } from "@/lib/cert-routes";
import { getDb } from "@/lib/db";
import { getTitleByManageToken } from "@/lib/queries";
import { siteHost } from "@/lib/site";

const Query = z.object({
  token: z.string().min(1).max(100),
  size: z.enum(["a4", "letter"]).default("a4"),
});

/**
 * High-resolution print file (A4 or US Letter at 300 dpi) for buyers of the
 * print add-on. Requires the manage token from the buyer's email.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const sp = new URL(request.url).searchParams;
  const q = Query.safeParse({ token: sp.get("token") ?? "", size: sp.get("size") ?? undefined });
  if (!q.success) return Response.json({ error: "Not found." }, { status: 404 });

  const { slug } = await params;
  try {
    const t = await getTitleByManageToken(await getDb(), q.data.token);
    if (!t || t.slug !== decodeSlug(slug) || !t.addonPrint || t.status !== "claimed") {
      return Response.json({ error: "Not found." }, { status: 404 });
    }
    const png = await renderCertificatePng(toImageData(t, siteHost(request)), q.data.size);
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="worlds-best-${q.data.size}.png"`,
      },
    });
  } catch (err) {
    console.error("print file failed", err instanceof Error ? err.message : err);
    return Response.json({ error: "Try again in a moment." }, { status: 503 });
  }
}
