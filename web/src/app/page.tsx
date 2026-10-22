import { ArrowRight, MagnifyingGlass, Sparkle } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Fragment, Suspense } from "react";

import AlertSignup from "@/components/AlertSignup";
import FilterBar from "@/components/FilterBar";
import HomeFeatures from "@/components/HomeFeatures";
import ListMemory from "@/components/ListMemory";
import CompanyMark from "@/components/CompanyMark";
import { Tag, remoteLabel } from "@/components/Tags";
import { CARD, H1, H2, LEAD, PAGE, PRIMARY, SECONDARY } from "@/components/ui";
import JobRow, { LIST } from "@/components/JobRow";
import { cleanFilters, describeFilters } from "@/lib/alerts";
import { COOKIE as PROFILE_COOKIE } from "@/lib/profile";
import { READ_ONLY } from "@/lib/mode";
import { SEARCH_PARAMS, SITE_URL, jsonLd } from "@/lib/seo";
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
  type Job,
} from "@/lib/queries";
import { ago } from "@/lib/time";

export const dynamic = "force-dynamic";

const n = (value: string | number) => Number(value).toLocaleString("en-US");

// The sync runs every two hours; well past that, say so rather than look fresh.
const STALE_AFTER_MS = 5 * 3_600_000;
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
  const sp = await props.searchParams;
  const query = filterQuery(sp);
  // Each filter combination is its own URL, and they're near-duplicates: keep
  // them out of the index (links on them still count), and point to "/".
  const filtered = SEARCH_PARAMS.some((k) => sp[k]);
  return {
    alternates: { canonical: "/", types: { "application/rss+xml": `/feed${query ? `?${query}` : ""}` } },
    ...(filtered && { robots: { index: false, follow: true } }),
  };
}

/** Live status: a dot that's green while the sync is keeping up, amber when it isn't. */
function Updated({ syncedAt }: { syncedAt: string }) {
  const stale = isStale(syncedAt);
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${stale ? "text-yellow-ink" : ""}`}
      title={stale ? "The refresh hasn't finished for a while" : "Career pages are re-read every two hours"}
    >
      <span aria-hidden className="relative flex size-2">
        {!stale && <span className="absolute inset-0 animate-ping rounded-full bg-accent opacity-40 motion-reduce:hidden" />}
        <span className={`relative size-2 rounded-full ${stale ? "bg-yellow-ink" : "bg-accent"}`} />
      </span>
      Updated <time dateTime={syncedAt}>{ago(syncedAt)}</time>
    </span>
  );
}

/** Counts and freshness above the list, once someone is searching. */
function Status({ syncedAt, open, remote }: { syncedAt: string | null; open: string; remote: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
      {syncedAt && <Updated syncedAt={syncedAt} />}
      <span>
        <span className="font-semibold tabular-nums text-ink-strong">{n(open)}</span> open roles
      </span>
      <span>
        <span className="font-semibold tabular-nums text-ink-strong">{n(remote)}</span> remote
      </span>
      {!READ_ONLY && (
        <Link href="/admin/companies" className="underline decoration-line underline-offset-4 hover:text-ink-strong">
          admin
        </Link>
      )}
    </p>
  );
}

/**
 * The hero's picture: the newest roles themselves, as they are right now, and
 * the numbers behind them. Real data, not an illustration of it.
 */
function JustPosted({ jobs, syncedAt, totals }: { jobs: Job[]; syncedAt: string | null; totals: { open: string; remote: string; companies: string } }) {
  return (
    <div className={`${CARD} rise overflow-hidden`} style={{ "--i": 3 } as React.CSSProperties}>
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-3.5 text-[13px]">
        <span className="font-semibold text-ink-strong">Just posted</span>
        {syncedAt && <span className="text-muted"><Updated syncedAt={syncedAt} /></span>}
      </div>
      <ul className="divide-y divide-line">
        {jobs.map((job) => {
          const remote = remoteLabel(job);
          return (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-hover/70">
                <CompanyMark name={job.company_name} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink-strong group-hover:text-accent-ink">{job.title}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">
                    {job.company_name}
                    {job.location_raw && `, ${job.location_raw}`}
                  </span>
                </span>
                {remote && (
                  <span className="hidden shrink-0 sm:block">
                    <Tag tone={remote.tone}>{remote.text}</Tag>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
      <dl className="grid grid-cols-3 divide-x divide-line border-t border-line bg-canvas/60">
        {[
          ["Career pages", totals.companies],
          ["Open roles", totals.open],
          ["Remote", totals.remote],
        ].map(([label, value]) => (
          <div key={label} className="px-5 py-4">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-1 text-xl font-semibold tabular-nums tracking-[-0.02em] text-ink-strong">{n(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Shown while the database is empty, e.g. during a full refill after maintenance. */
function Refreshing() {
  return (
    <main id="main" className={`${PAGE} pb-20 pt-16 sm:pt-24`}>
      <section className={`${CARD} max-w-xl p-6 sm:p-8`}>
        <p className="inline-flex items-center gap-2 rounded-md bg-yellow-bg px-2 py-1 text-xs font-medium text-yellow-ink">
          <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-yellow-ink" />
          Refreshing
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-ink-strong">The job list is being rebuilt.</h1>
        <p className="mt-3 text-pretty text-[15px] leading-relaxed text-ink">
          Unlisted is re-reading every company career page from scratch. Jobs come back in about half an
          hour, all at once when the refresh finishes.
        </p>
        <Link href="/" className={`${PRIMARY} mt-6`}>
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
  // Jobs exist, so cached counts of nothing are from before a refill: ask
  // again, and the list may be from then too. (An empty search on its own is
  // just a search that matches nothing.)
  if (Number(fc.totals.open) === 0) {
    fc = await fresh.facets();
    if (jobs.length === 0 && !f.cursor) ({ jobs, nextCursor } = await fresh.listJobs(f));
  }

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
  // The introduction is for arriving: once someone searches, results come first.
  const showIntro = !filtered && !f.cursor && pageCount(f.pages) === 1;
  const hasProfile = (await cookies()).has(PROFILE_COOKIE);
  const alertFilters = cleanFilters(sp);


  return (
    <main id="main" className="pb-24">
      {/* The site's name in Google results is "Unlisted", not the domain. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Unlisted",
            alternateName: ["findunlisted", "Find Unlisted"],
            url: `${SITE_URL}/`,
            potentialAction: {
              "@type": "SearchAction",
              target: `${SITE_URL}/?q={search_term_string}`,
              "query-input": "required name=search_term_string",
            },
          }),
        }}
      />
      {showIntro && (
        <>
          <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-line">
            {/* A faint pine wash behind the hero: depth, not decoration. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_85%_0%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent_70%)]"
            />
            <div className={`${PAGE} relative grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-[1.25fr_1fr] lg:gap-12`}>
              <div>
                <h1
                  id="hero-title"
                  className="rise text-balance text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.045em] text-ink-strong sm:text-6xl lg:text-[3.3rem] xl:text-[3.5rem]"
                >
                  Jobs straight from company career pages.
                </h1>
                <p className={`${LEAD} rise mt-6 max-w-[46ch]`} style={{ "--i": 1 } as React.CSSProperties}>
                  Unlisted reads {n(fc.totals.companies)} career pages every two hours, including roles that never
                  reach job boards.
                </p>
                <div className="rise mt-9 flex flex-wrap items-center gap-3" style={{ "--i": 2 } as React.CSSProperties}>
                  <Link href="/for-you" className={`${PRIMARY} h-12 px-6 text-[15px]`}>
                    <Sparkle aria-hidden size={17} weight="fill" />
                    {hasProfile ? "Open your feed" : "Get your personal feed"}
                  </Link>
                  <a href="#roles" className={`${SECONDARY} h-12 px-6 text-[15px]`}>
                    <MagnifyingGlass aria-hidden size={17} />
                    Browse {n(fc.totals.open)} roles
                  </a>
                </div>
              </div>
              <JustPosted jobs={jobs.slice(0, 4)} syncedAt={syncedAt} totals={fc.totals} />
            </div>
          </section>
          <HomeFeatures hasProfile={hasProfile} />
        </>
      )}

      <ListMemory />
      <section
        id="roles"
        aria-labelledby="roles-title"
        className={`${PAGE} scroll-mt-20 ${showIntro ? "mt-20 sm:mt-24" : "mt-8 sm:mt-12"}`}
      >
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          {showIntro ? (
            <h2 id="roles-title" className={H2}>
              All roles
            </h2>
          ) : (
            <h1 id="roles-title" className={H1}>
              All roles
            </h1>
          )}
          <Status syncedAt={syncedAt} open={fc.totals.open} remote={fc.totals.remote} />
        </div>

        <Suspense fallback={<div className="h-[118px]" />}>
          <FilterBar
            countries={fc.countries}
            departments={fc.departments}
          />
        </Suspense>

        <AlertSignup
          filters={alertFilters as Record<string, string>}
          rss={`/feed${query ? `?${query}` : ""}`}
          what={describeFilters(alertFilters)}
        />

        {jobs.length > 0 && (
          <ul className={`${LIST} mt-4`}>
            {jobs.map((job, i) => (
              <Fragment key={job.id}>
                <JobRow job={job} />
                {i === 7 && !hasProfile && (
                  <li className="bg-accent-soft/60 px-4 py-4 sm:px-5">
                    <Link
                      href="/for-you"
                      className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
                    >
                      <span className="flex min-w-0 items-center gap-3.5 text-sm">
                        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-accent text-accent-fg">
                          <Sparkle size={18} weight="fill" />
                        </span>
                        <span>
                          <span className="block font-semibold text-ink-strong">Too many to scroll?</span>
                          <span className="text-ink">For you ranks every role by your roles, skills and CV.</span>
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-ink">
                        Try it
                        <ArrowRight aria-hidden size={15} weight="bold" className="transition-transform duration-200 group-hover:translate-x-0.5" />
                      </span>
                    </Link>
                  </li>
                )}
              </Fragment>
            ))}
          </ul>
        )}

        {jobs.length === 0 && (
          <div className={`${CARD} mt-4 px-6 py-20 text-center`}>
            <span aria-hidden className="mx-auto grid size-12 place-items-center rounded-2xl bg-hover text-muted">
              <MagnifyingGlass size={22} />
            </span>
            <p className="mt-5 text-lg font-semibold text-ink-strong">Nothing matches.</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted">
              {f.q ? <>No role in the past {MAX_AGE_DAYS} days mentions &ldquo;{f.q}&rdquo; with these filters.</> : <>No role in the past {MAX_AGE_DAYS} days fits these filters.</>}
            </p>
            {filtered && (
              <Link href="/" className={`${SECONDARY} mt-6`}>
                Clear filters
              </Link>
            )}
          </div>
        )}

        {nextCursor && (
          <div className="mt-10 flex justify-center">
            <Link href={`/?${nextParams.toString()}`} scroll={!growInPlace} className={SECONDARY}>
              Show older roles
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}
