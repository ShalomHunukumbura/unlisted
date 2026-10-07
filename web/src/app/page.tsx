import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import AlertSignup from "@/components/AlertSignup";
import FilterBar from "@/components/FilterBar";
import { Tag, payLabel, remoteLabel } from "@/components/Tags";
import { expLabel } from "@/lib/experience";
import { cleanFilters } from "@/lib/alerts";
import { READ_ONLY } from "@/lib/mode";
import {
  MAX_AGE_DAYS,
  MAX_PAGES,
  facets,
  fresh,
  hasOpenJobs,
  lastSync,
  listJobs,
  pageCount,
  type Filters,
} from "@/lib/queries";
import { ago } from "@/lib/time";

export const dynamic = "force-dynamic";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

const n = (value: string | number) => Number(value).toLocaleString("en-US");

// The sync runs hourly; well past that, say so rather than look fresh.
const STALE_AFTER_MS = 3 * 3_600_000;
const isStale = (iso: string) => Date.now() - new Date(iso).getTime() > STALE_AFTER_MS;

/** The current filters as a query string, without paging. */
function filterQuery(sp: Record<string, string | string[] | undefined>): string {
  return new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v && k !== "cursor" && k !== "pages" ? [[k, String(v)]] : [],
    ) as [string, string][],
  ).toString();
}

// Lets feed readers find the RSS feed for whatever search is on screen.
export async function generateMetadata(props: PageProps<'/'>): Promise<Metadata> {
  const query = filterQuery(await props.searchParams);
  return { alternates: { types: { "application/rss+xml": `/feed${query ? `?${query}` : ""}` } } };
}

/** Shown while the database is empty, e.g. during a full refill after maintenance. */
function Refreshing() {
  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-10 sm:pt-16">
      <h1 className="font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">Unlisted</h1>
      <section className="mt-10 max-w-xl rounded-xl border border-line bg-surface p-6 sm:p-8">
        <p className="flex items-center gap-2 font-mono text-xs uppercase tracking-[0.06em] text-muted">
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-yellow-ink" />
          Refreshing
        </p>
        <h2 className="mt-3 font-serif text-3xl leading-tight tracking-[-0.01em] text-ink-strong">
          The job list is being rebuilt.
        </h2>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
          Unlisted is re-reading every company career page from scratch. Jobs come back in about half an
          hour, all at once when the refresh finishes.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]"
        >
          Check again
        </Link>
      </section>
    </main>
  );
}

// searchParams is a Promise in Next.js 16 and must be awaited.
export default async function Home(props: PageProps<'/'>) {
  const sp = await props.searchParams;
  const f: Filters = {
    q: sp.q as string,
    remote: sp.remote as string,
    country: sp.country as string,
    company: sp.company as string,
    department: sp.department as string,
    since: sp.since as string,
    exp: sp.exp as string,
    pay: sp.pay as string,
    cursor: sp.cursor as string,
    pages: sp.pages as string,
  };

  if (!(await hasOpenJobs())) return <Refreshing />;

  const synced = lastSync();
  let [{ jobs, nextCursor }, fc] = await Promise.all([listJobs(f), facets()]);
  // Jobs exist, so a cached "nothing" is from before a refill: ask again.
  if (Number(fc.totals.open) === 0) fc = await fresh.facets();
  if (jobs.length === 0 && !f.cursor) ({ jobs, nextCursor } = await fresh.listJobs(f));

  const query = filterQuery(sp);
  // Grow the list in place while that's cheap; after MAX_PAGES, page by cursor.
  const pages = pageCount(f.pages);
  const growInPlace = !f.cursor && pages < MAX_PAGES;
  const nextParams = new URLSearchParams(query);
  if (nextCursor) {
    if (growInPlace) nextParams.set("pages", String(pages + 1));
    else nextParams.set("cursor", nextCursor);
  }
  const filtered = query !== "";
  const syncedAt = await synced;
  const stale = syncedAt ? isStale(syncedAt) : false;

  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-10 sm:pt-16">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h1 className="font-serif text-5xl leading-none tracking-[-0.02em] text-ink-strong sm:text-6xl">
            Unlisted
          </h1>
          <p className="mt-3 max-w-md text-pretty text-[15px] leading-relaxed text-ink">
            Every role posted on {n(fc.totals.companies)} company career pages in the past{" "}
            {MAX_AGE_DAYS} days, straight from the source, including the ones that never reach job boards.
          </p>
        </div>
        <dl className="flex gap-6 text-xs text-muted">
          <div>
            <dt>Open roles</dt>
            <dd className="mt-0.5 text-lg font-medium tabular-nums text-ink-strong">{n(fc.totals.open)}</dd>
          </div>
          <div>
            <dt>Remote</dt>
            <dd className="mt-0.5 text-lg font-medium tabular-nums text-ink-strong">{n(fc.totals.remote)}</dd>
          </div>
          {syncedAt && (
            <div>
              <dt>Updated</dt>
              <dd
                className={`mt-0.5 text-lg font-medium tabular-nums ${stale ? "text-yellow-ink" : "text-ink-strong"}`}
                title={stale ? "The hourly refresh hasn't finished for a while" : "Career pages are re-read every hour"}
              >
                <time dateTime={syncedAt}>{ago(syncedAt)}</time>
              </dd>
            </div>
          )}
          {!READ_ONLY && (
            <div>
              <dt>Admin</dt>
              <dd className="mt-0.5 text-lg">
                <Link href="/admin/companies" className="text-ink-strong underline decoration-line underline-offset-4 hover:decoration-current">
                  companies
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <Suspense fallback={<div className="h-[92px]" />}>
        <FilterBar
          countries={fc.countries}
          departments={fc.departments}
        />
      </Suspense>

      <AlertSignup filters={cleanFilters(sp) as Record<string, string>} rss={`/feed${query ? `?${query}` : ""}`} />

      <ul className="mt-2 border-t border-line">
        {jobs.map((job) => {
          const remote = remoteLabel(job);
          const exp = expLabel(job.exp_min_years, job.exp_max_years);
          const pay = payLabel(job);
          const more = (job.role_locations ?? 1) > 1
            ? `+${job.role_locations! - 1} more ${job.role_locations === 2 ? "location" : "locations"}`
            : (job.role_postings ?? 1) > 1
              ? `${job.role_postings} openings`
              : null;
          return (
            <li key={job.id} className="border-b border-line">
              <Link
                href={`/jobs/${job.id}`}
                className="group -mx-3 flex gap-4 rounded-lg px-3 py-4 transition-colors duration-200 hover:bg-hover"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="text-pretty text-[15px] font-medium leading-snug text-ink-strong">
                    {job.title}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    <span className="text-ink">{job.company_name}</span>
                    {job.location_raw && <> · {job.location_raw}</>}
                    {more && <span className="text-ink"> · {more}</span>}
                  </p>
                  {(remote || job.remote_scope === "hybrid" || job.department || exp || pay) && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pay && <Tag mono title="Base pay stated on the posting">{pay}</Tag>}
                      {remote && <Tag tone={remote.tone} title={remote.title}>{remote.text}</Tag>}
                      {job.remote_scope === "hybrid" && <Tag>Hybrid</Tag>}
                      {exp && (
                        <Tag
                          mono
                          title={job.exp_source === "title" ? "Guessed from the job title" : "Stated in the description"}
                        >
                          {job.exp_source === "title" ? `~${exp}` : exp}
                        </Tag>
                      )}
                      {job.department && <Tag>{job.department}</Tag>}
                    </div>
                  )}
                </div>
                <time
                  dateTime={job.posted_at ?? undefined}
                  className="shrink-0 pt-0.5 font-mono text-xs tabular-nums text-muted"
                >
                  {timeAgo(job.posted_at)}
                </time>
              </Link>
            </li>
          );
        })}
      </ul>

      {jobs.length === 0 && (
        <div className="py-20 text-center">
          <p className="font-serif text-2xl text-ink-strong">Nothing matches.</p>
          <p className="mt-2 text-sm text-muted">
            {f.q ? <>No role in the past {MAX_AGE_DAYS} days mentions &ldquo;{f.q}&rdquo; with these filters.</> : <>No role in the past {MAX_AGE_DAYS} days fits these filters.</>}
          </p>
          {filtered && (
            <Link
              href="/"
              className="mt-5 inline-block rounded-md border border-line px-4 py-2 text-sm text-ink-strong transition-colors hover:bg-hover active:scale-[0.98]"
            >
              Clear filters
            </Link>
          )}
        </div>
      )}

      {nextCursor && (
        <div className="mt-10 flex justify-center">
          <Link
            href={`/?${nextParams.toString()}`}
            scroll={!growInPlace}
            className="rounded-md bg-ink-strong px-5 py-2.5 text-sm font-medium text-canvas transition-[opacity,transform] duration-200 hover:opacity-85 active:scale-[0.98]"
          >
            Show older roles
          </Link>
        </div>
      )}
    </main>
  );
}
