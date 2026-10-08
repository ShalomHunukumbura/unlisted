import { allPosts } from "@/lib/blog";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The blog as RSS: the newest 30 posts. */
export async function GET() {
  const posts = (await allPosts()).slice(0, 30);
  const items = posts
    .map((p) => {
      const url = `${SITE_URL}/blog/${p.slug}`;
      return `<item>
  <title>${escape(p.title)}</title>
  <link>${url}</link>
  <guid isPermaLink="true">${url}</guid>
  <pubDate>${new Date(`${p.date}T00:00:00Z`).toUTCString()}</pubDate>
  <category>${escape(p.category)}</category>
  <description>${escape(p.description)}</description>
</item>`;
    })
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Unlisted blog</title>
  <link>${SITE_URL}/blog</link>
  <description>Weekly hiring numbers from 7,700 company careers pages, and guides to finding roles that never reach job boards.</description>
${items}
</channel>
</rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
