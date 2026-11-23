import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Public pages. Certificates are discovered through links, not listed, so holders aren't indexed in bulk. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return ["", "/registry", "/gifts", "/pricing", "/about", "/contact", "/refunds", "/delivery", "/terms", "/privacy"].map((p) => ({
    url: `${base}${p}`,
    changeFrequency: p === "" || p === "/registry" ? "daily" : "monthly",
    priority: p === "" ? 1 : 0.6,
  }));
}
