import { IMAGE_SIZES, certificateImageResponse } from "@/lib/cert-image";
import { PUBLIC_IMAGE_CACHE, publicImageData } from "@/lib/cert-routes";
import { siteHost } from "@/lib/site";

export const alt = "A certificate from The World's Best Registry";
export const size = IMAGE_SIZES.share;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const host = siteHost();
  return certificateImageResponse(await publicImageData(slug, host), "share", PUBLIC_IMAGE_CACHE, host);
}
