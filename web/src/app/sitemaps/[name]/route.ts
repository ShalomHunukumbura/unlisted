import { SITEMAPS, urlset } from "@/lib/sitemap";

// Built on request from hourly-cached queries: the jobs change every sync.
export const dynamic = "force-dynamic";

/** /sitemaps/pages.xml, /sitemaps/companies.xml and /sitemaps/jobs.xml. */
export async function GET(_req: Request, ctx: RouteContext<"/sitemaps/[name]">) {
  const { name } = await ctx.params;
  const key = name.replace(/\.xml$/, "");
  if (!name.endsWith(".xml") || !Object.hasOwn(SITEMAPS, key)) return new Response("Not found", { status: 404 });
  return urlset(await SITEMAPS[key as keyof typeof SITEMAPS]());
}
