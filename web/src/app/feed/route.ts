import { payLabel, remoteLabel } from "@/components/Tags";
import { MAX_AGE_DAYS, listJobs, type Filters } from "@/lib/queries";

const FILTER_KEYS = ["q", "remote", "country", "company", "department", "since", "exp", "pay"] as const;

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * RSS for any search: /feed takes the same filters as the home page, so a
 * search can be followed in a feed reader with no account. The newest 50
 * roles; a reader keeps the ones it has already shown.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const f: Filters = {};
  for (const key of FILTER_KEYS) {
    const value = url.searchParams.get(key);
    if (value) f[key] = value;
  }
  const { jobs } = await listJobs(f);

  const query = url.searchParams.toString();
  const page = `${url.origin}/${query ? `?${query}` : ""}`;
  const described = Object.entries(f).map(([k, v]) => `${k}: ${v}`).join(", ");

  const items = jobs
    .map((job) => {
      const where = [job.location_raw, remoteLabel(job)?.text].filter(Boolean).join(" · ");
      const details = [where, payLabel(job), job.department].filter(Boolean).join(" · ");
      return `
    <item>
      <title>${escape(`${job.title} at ${job.company_name}`)}</title>
      <link>${url.origin}/jobs/${job.id}</link>
      <guid isPermaLink="true">${url.origin}/jobs/${job.id}</guid>
      ${job.posted_at ? `<pubDate>${new Date(job.posted_at).toUTCString()}</pubDate>` : ""}
      <description>${escape(details)}</description>
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escape(described ? `Unlisted: ${described}` : "Unlisted: all new roles")}</title>
    <link>${escape(page)}</link>
    <atom:link href="${escape(url.href)}" rel="self" type="application/rss+xml" />
    <description>Roles from company career pages, posted in the past ${MAX_AGE_DAYS} days.</description>
    <ttl>60</ttl>${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      // Readers poll; the edge answers most of them. The data changes hourly.
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
