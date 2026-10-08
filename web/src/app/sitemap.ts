import type { MetadataRoute } from "next";

import { allPosts } from "@/lib/blog";
import {
  MIN_ROLES,
  REMOTE_PAGES,
  ROLE_LANDINGS,
  SITE_URL,
  companiesWithJobs,
  countriesWithJobs,
  countryLanding,
  sitemapJobs,
} from "@/lib/seo";

// Built on request from hourly-cached queries: the jobs change every sync.
export const dynamic = "force-dynamic";

/**
 * Every page worth a search result: the landing pages, every company with a
 * role this week, and every open role (its newest posting). Jobs leave the
 * sitemap the same hour they leave the site. ~15,000 URLs, under the 50,000
 * a sitemap file may hold.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [jobs, companies, countries, posts] = await Promise.all([
    sitemapJobs(),
    companiesWithJobs(),
    countriesWithJobs(),
    allPosts(),
  ]);
  const now = new Date();
  const page = (path: string, priority: number, lastModified: Date = now): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: "hourly",
    priority,
  });
  return [
    page("/", 1),
    ...REMOTE_PAGES.map((l) => page(l.path, 0.9)),
    page("/blog", 0.8),
    ...posts.map((p) => page(`/blog/${p.slug}`, 0.7, new Date(`${p.date}T00:00:00Z`))),
    page("/roles", 0.6),
    ...ROLE_LANDINGS.map((l) => page(l.path, 0.8)),
    page("/locations", 0.6),
    ...countries.filter((c) => c.n >= MIN_ROLES).map((c) => page(countryLanding(c.country).path, 0.7)),
    page("/companies", 0.6),
    ...[..."abcdefghijklmnopqrstuvwxyz", "0-9"].map((l) => page(`/companies?letter=${l}`, 0.4)),
    ...companies.map((c) => page(`/companies/${c.slug}`, 0.5)),
    ...jobs.map((j) => ({ url: `${SITE_URL}/jobs/${j.id}`, lastModified: new Date(j.at), changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
