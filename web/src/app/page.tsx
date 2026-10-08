import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Fragment, Suspense } from "react";

import AlertSignup from "@/components/AlertSignup";
import FilterBar from "@/components/FilterBar";
import HomeFeatures from "@/components/HomeFeatures";
import ListMemory from "@/components/ListMemory";
import { PRIMARY } from "@/components/ui";
import JobRow from "@/components/JobRow";
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
} from "@/lib/queries";
import { ago } from "@/lib/time";

export const dynamic = "force-dynamic";

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

/** Live status: a dot that's green while the hourly sync is keeping up. */
function Status({ syncedAt, open, remote }: { syncedAt: string | null; open: string; remote: string }) {
  const stale = syncedAt ? isStale(syncedAt) : false;
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted">
      {syncedAt && (
        <span
          className="inline-flex items-center gap-1.5"
          title={stale ? "The hourly refresh hasn't finished for a while" : "Career pages are re-read every hour"}
        >
          <span aria-hidden className={`size-1.5 rounded-full ${stale ? "bg-yellow-ink" : "bg-green-ink"}`} />
          <span className={stale ? "text-yellow-ink" : undefined}>
            Updated <time dateTime={syncedAt}>{ago(syncedAt)}</time>
          </span>
        </span>
      )}
      <span>
        <span className="text-ink-strong">{n(open)}</span> open roles
      </span>
      <span>
        <span className="text-ink-strong">{n(remote)}</span> remote
      </span>
      {!READ_ONLY && (
        <Link href="/admin/companies" className="underline decoration-line underline-offset-4 hover:text-ink-strong">
          admin
        </Link>
      )}
    </p>
  );
}

/** Shown while the database is empty, e.g. during a full refill after maintenance. */
function Refreshing() {
  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
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
  // The introduction is for arriving: once someone searches, results come first.
  const showIntro = !filtered && !f.cursor && pageCount(f.pages) === 1;
  const hasProfile = (await cookies()).has(PROFILE_COOKIE);
  const alertFilters = cleanFilters(sp);


  return (
    <main id="main" className="mx-auto w-full min-w-0 max-w-5xl px-4 pb-16 pt-8 sm:pt-12">
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
          <section aria-labelledby="hero-title" className="pt-4 sm:pt-8">
            <Status syncedAt={syncedAt} open={fc.totals.open} remote={fc.totals.remote} />
            <h1
              id="hero-title"
              className="mt-5 max-w-3xl text-balance font-serif text-[2.75rem] leading-[1.02] tracking-[-0.025em] text-ink-strong sm:text-7xl"
            >
              Every new role, straight from the company’s own careers page.
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-[17px] leading-relaxed text-ink">
              Unlisted reads {n(fc.totals.companies)} career pages every hour and keeps the past {MAX_AGE_DAYS} days,
              including roles that never reach job boards. Every listing links to the employer&apos;s own posting.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link href="/for-you" className={PRIMARY}>
                {hasProfile ? "Open your feed" : "Get your personal feed"}
                <span aria-hidden>→</span>
              </Link>
              <a
                href="#roles"
                className="text-sm font-medium text-ink-strong underline decoration-line underline-offset-4 transition-colors hover:decoration-current"
              >
                Browse all {n(fc.totals.open)} roles
              </a>
            </div>
          </section>
          <HomeFeatures hasProfile={hasProfile} />
        </>
      )}

      <ListMemory />
      <section id="roles" aria-labelledby="roles-title" className={showIntro ? "mt-16 scroll-mt-4 sm:mt-20" : "mt-6 sm:mt-10"}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          {showIntro ? (
            <h2 id="roles-title" className="font-serif text-3xl tracking-[-0.01em] text-ink-strong sm:text-4xl">
              All roles
            </h2>
          ) : (
            <h1 id="roles-title" className="font-serif text-3xl tracking-[-0.01em] text-ink-strong sm:text-4xl">
              All roles
            </h1>
          )}
          {!showIntro && <Status syncedAt={syncedAt} open={fc.totals.open} remote={fc.totals.remote} />}
        </div>

        <Suspense fallback={<div className="h-[92px]" />}>
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

      <ul className="mt-4 border-t border-line">
        {jobs.map((job, i) => (
          <Fragment key={job.id}>
            <JobRow job={job} />
            {i === 7 && !hasProfile && (
              <li className="border-b border-line py-4">
                <Link
                  href="/for-you"
                  className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3.5 transition-colors duration-200 hover:border-muted"
                >
                  <span className="min-w-0 text-sm">
                    <span className="font-medium text-ink-strong">Too many to scroll? </span>
                    <span className="text-ink">For you ranks every role by your roles, skills and CV.</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-strong">
                    Try it
                    <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
                  </span>
                </Link>
              </li>
            )}
          </Fragment>
        ))}
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
      </section>
    </main>
  );
}
