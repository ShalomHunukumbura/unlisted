import { sitemapIndex } from "@/lib/sitemap";

// The address search engines were given: now an index of the files under /sitemaps.
export const dynamic = "force-dynamic";

export function GET() {
  return sitemapIndex();
}
