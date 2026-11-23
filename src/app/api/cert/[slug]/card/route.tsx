import { certificateImageResponse } from "@/lib/cert-image";
import { PUBLIC_IMAGE_CACHE, publicImageData } from "@/lib/cert-routes";
import { siteHost } from "@/lib/site";

/** 1080 x 1350 Christmas card made from a certificate. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await params;
  const host = siteHost(request);
  const res = await certificateImageResponse(await publicImageData(slug, host), "christmas", PUBLIC_IMAGE_CACHE, host);
  if (new URL(request.url).searchParams.has("download")) {
    res.headers.set("Content-Disposition", `attachment; filename="worlds-best-christmas-card.png"`);
  }
  return res;
}
