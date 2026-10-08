import Link from "next/link";

import JobRow from "@/components/JobRow";
import ListMemory from "@/components/ListMemory";
import { countRoles, listJobsAlwaysCached, type Filters } from "@/lib/queries";
import type { Landing } from "@/lib/seo";

const n = (value: number) => value.toLocaleString("en-US");

/** The search page with these filters: where "See all" and the full filter bar are. */
export function searchHref(f: Filters) {
  const qs = new URLSearchParams(
    Object.entries(f).filter(([, v]) => typeof v === "string" && v) as [string, string][],
  ).toString();
  return `/${qs ? `?${qs}` : ""}`;
}

export type RelatedLink = { href: string; label: string };

/**
 * A page made for search engines and for people arriving from them: one
 * clear topic (remote jobs, a role, a country, a company), a real heading and
 * intro, the newest roles, and links on to related pages. The list is the
 * same one the search page shows for these filters.
 */
export default async function LandingPage({
  landing,
  related = [],
  eyebrow,
}: {
  landing: Landing;
  related?: RelatedLink[];
  /** A small line above the heading, e.g. the company's careers site. */
  eyebrow?: React.ReactNode;
}) {
  const [{ jobs }, total] = await Promise.all([listJobsAlwaysCached(landing.filters), countRoles(landing.filters)]);
  const all = searchHref(landing.filters);

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
      <ListMemory />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/" className="transition-colors hover:text-ink-strong">
          Unlisted
        </Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{landing.title}</span>
      </nav>
      <header className="mb-8 mt-4">
        {eyebrow && <p className="mb-2 text-sm text-ink">{eyebrow}</p>}
        <h1 className="text-balance font-serif text-4xl leading-[1.05] tracking-[-0.02em] text-ink-strong sm:text-5xl">
          {landing.title}
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-[15px] leading-relaxed text-ink">
          {total > 0
            ? <>{landing.intro.replace("{n}", n(total))} Every listing links to the employer&apos;s own posting.</>
            : "Nothing open from the past week. Unlisted only keeps a week of roles, and new ones come in every hour."}
        </p>
      </header>

      {jobs.length > 0 && (
        <ul className="border-t border-line">
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>
      )}

      {jobs.length === 0 ? null : (
        <div className="mt-10 flex justify-center">
          <Link
            href={all}
            className="rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]"
          >
            {total > jobs.length ? `See all ${n(total)} and filter` : "Search and filter these"}
          </Link>
        </div>
      )}

      {related.length > 0 && (
        <nav aria-label="Related" className="mt-16 border-t border-line pt-6">
          <h2 className="text-sm font-medium text-ink-strong">Related</h2>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {related.map((r) => (
              <li key={r.href}>
                <Link href={r.href} className="text-ink underline decoration-line underline-offset-4 hover:text-ink-strong">
                  {r.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </main>
  );
}
