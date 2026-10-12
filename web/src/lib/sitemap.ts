import { allPosts } from "./blog";
import {
  MIN_ROLES,
  REMOTE_PAGES,
  ROLE_LANDINGS,
  SITE_URL,
  companiesWithJobs,
  countriesWithJobs,
  countryLanding,
  sitemapJobs,
} from "./seo";

/**
 * The sitemaps. /sitemap.xml is an index of three files, so Search Console
 * reports each kind of page on its own: the pages that last (landing pages and
 * the blog), the companies, and the jobs, which are only up for a week.
 * ~22,000 URLs in all; one file may hold 50,000.
 */

type Entry = { path: string; lastModified: Date; changeFrequency: "hourly" | "daily"; priority: number };

export const SITEMAPS = {
  pages: async (): Promise<Entry[]> => {
    const [countries, posts] = await Promise.all([countriesWithJobs(), allPosts()]);
    return [
      page("/", 1),
      ...REMOTE_PAGES.map((l) => page(l.path, 0.9)),
      page("/blog", 0.8),
      ...posts.map((p) => page(`/blog/${p.slug}`, 0.7, new Date(`${p.date}T00:00:00Z`))),
      page("/roles", 0.6),
      ...ROLE_LANDINGS.map((l) => page(l.path, 0.8)),
      page("/locations", 0.6),
      ...countries.filter((c) => c.n >= MIN_ROLES).map((c) => page(countryLanding(c.country).path, 0.7)),
    ];
  },
  /** Every company with a role this week. */
  companies: async (): Promise<Entry[]> => [
    page("/companies", 0.6),
    ...[..."abcdefghijklmnopqrstuvwxyz", "0-9"].map((l) => page(`/companies?letter=${l}`, 0.4)),
    ...(await companiesWithJobs()).map((c) => page(`/companies/${c.slug}`, 0.5)),
  ],
  /** Every open role (its newest posting). Jobs leave the same hour they leave the site. */
  jobs: async (): Promise<Entry[]> =>
    (await sitemapJobs()).map((j) => ({
      path: `/jobs/${j.id}`,
      lastModified: new Date(j.at),
      changeFrequency: "daily" as const,
      priority: 0.6,
    })),
};

function page(path: string, priority: number, lastModified: Date = new Date()): Entry {
  return { path, lastModified, changeFrequency: "hourly", priority };
}

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const loc = (path: string) => `<loc>${escape(SITE_URL + path)}</loc>`;

/**
 * Built from hourly data in a few seconds: let the CDN keep it for the hour,
 * so search engines get it instantly and it's built once.
 */
function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n${body}\n`, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export function sitemapIndex(): Response {
  const now = new Date().toISOString();
  const files = Object.keys(SITEMAPS).map((name) => `<sitemap>${loc(`/sitemaps/${name}.xml`)}<lastmod>${now}</lastmod></sitemap>`);
  return xml(`<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${files.join("\n")}\n</sitemapindex>`);
}

export function urlset(entries: Entry[]): Response {
  const urls = entries.map(
    (e) =>
      `<url>${loc(e.path)}<lastmod>${e.lastModified.toISOString()}</lastmod>` +
      `<changefreq>${e.changeFrequency}</changefreq><priority>${e.priority}</priority></url>`,
  );
  return xml(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>`);
}
