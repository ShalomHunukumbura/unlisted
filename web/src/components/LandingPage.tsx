import { ArrowRight, CaretRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";

import JobRow, { LIST } from "@/components/JobRow";
import ListMemory from "@/components/ListMemory";
import { H1, LEAD, PAGE, SECONDARY } from "@/components/ui";
import { MAX_AGE_DAYS, countRoles, listJobs, type Filters } from "@/lib/queries";
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
  actions,
}: {
  landing: Landing;
  related?: RelatedLink[];
  /** A small line above the heading, e.g. the company's careers site. */
  eyebrow?: React.ReactNode;
  /** Under the intro, e.g. Follow on a company's page. */
  actions?: React.ReactNode;
}) {
  const [{ jobs }, total] = await Promise.all([listJobs(landing.filters), countRoles(landing.filters)]);
  const all = searchHref(landing.filters);

  return (
    <main id="main" className={`${PAGE} pb-24 pt-8 sm:pt-10`}>
      <ListMemory />
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted">
        <Link href="/" className="transition-colors hover:text-ink-strong">
          Unlisted
        </Link>
        <CaretRight aria-hidden size={12} />
        <span className="text-ink">{landing.title}</span>
      </nav>
      <header className="rise mb-10 mt-6">
        {eyebrow && <p className="mb-2 text-sm text-ink">{eyebrow}</p>}
        <h1 className={H1}>{landing.title}</h1>
        <p className={`${LEAD} mt-4`}>
          {total > 0
            ? <>{landing.intro.replace("{n}", n(total))} Every listing links to the employer&apos;s own posting.</>
            : `Nothing open from the past ${MAX_AGE_DAYS} days. Unlisted only keeps ${MAX_AGE_DAYS} days of roles, and new ones come in every two hours.`}
        </p>
        {actions && <div className="mt-6">{actions}</div>}
      </header>

      {jobs.length > 0 && (
        <ul className={LIST}>
          {jobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </ul>
      )}

      {jobs.length === 0 ? null : (
        <div className="mt-10 flex justify-center">
          <Link href={all} className={SECONDARY}>
            {total > jobs.length ? `See all ${n(total)} and filter` : "Search and filter these"}
            <ArrowRight aria-hidden size={15} weight="bold" />
          </Link>
        </div>
      )}

      {related.length > 0 && (
        <nav aria-label="Related" className="mt-20 border-t border-line pt-8">
          <h2 className="text-sm font-semibold text-ink-strong">Related</h2>
          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            {related.map((r) => (
              <li key={r.href}>
                <Link
                  href={r.href}
                  className="inline-block rounded-[10px] border border-line bg-surface px-3 py-2 font-medium text-ink transition-colors hover:border-line-strong hover:text-ink-strong"
                >
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
