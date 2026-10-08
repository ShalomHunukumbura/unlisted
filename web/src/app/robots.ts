import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/seo";

/**
 * Crawl everything public; skip what's personal (For you, alert links), the
 * API and admin. Filtered search pages are left crawlable, so links on them
 * are followed, but each says noindex itself (see the home page's metadata).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/for-you", "/alerts/", "/api/", "/admin/", "/feed"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
