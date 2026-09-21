import Link from "next/link";
import { Suspense } from "react";

import FilterBar from "@/components/FilterBar";
import { expLabel } from "@/lib/experience";
import { facets, listJobs, type Filters } from "@/lib/queries";

export const dynamic = "force-dynamic";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
      {children}
    </span>
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
    cursor: sp.cursor as string,
  };

  const [{ jobs, nextCursor }, fc] = await Promise.all([listJobs(f), facets()]);

  const nextParams = new URLSearchParams(
    Object.entries(sp).flatMap(([k, v]) =>
      v && k !== "cursor" ? [[k, String(v)]] : [],
    ) as [string, string][],
  );
  if (nextCursor) nextParams.set("cursor", nextCursor);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">ATS Job Board</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {Number(fc.totals.open).toLocaleString()} open roles ·{" "}
            {Number(fc.totals.remote).toLocaleString()} remote ·{" "}
            {fc.totals.companies} companies
          </p>
        </div>
        <Link href="/admin/companies" className="text-sm text-neutral-500 hover:underline">
          Manage companies →
        </Link>
      </header>

      <Suspense fallback={<div className="h-9" />}>
        <FilterBar
          companies={fc.companies}
          countries={fc.countries}
          departments={fc.departments}
        />
      </Suspense>

      <ul className="mt-6 divide-y divide-neutral-200 dark:divide-neutral-800">
        {jobs.map((job) => (
          <li key={job.id} className="py-3">
            <div className="flex items-baseline justify-between gap-4">
              <Link
                href={`/jobs/${job.id}`}
                className="font-medium hover:underline underline-offset-2"
              >
                {job.title}
              </Link>
              <span className="shrink-0 text-xs text-neutral-400">
                {timeAgo(job.posted_at)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {job.company_name}
              </span>
              {job.location_raw && <span>· {job.location_raw}</span>}
              {job.remote && (
                <Tag>
                  {job.open_to === "anywhere"
                    ? "remote · anywhere 🌍"
                    : job.open_to === "region"
                      ? `remote · ${job.region ?? "region"}`
                      : job.open_to === "country"
                        ? `remote · ${job.country ?? "restricted"}`
                        : "remote"}
                </Tag>
              )}
              {job.remote_scope === "hybrid" && <Tag>hybrid</Tag>}
              {job.department && <Tag>{job.department}</Tag>}
              {expLabel(job.exp_min_years, job.exp_max_years) && (
                <Tag>
                  {expLabel(job.exp_min_years, job.exp_max_years)}
                  {/* mark levels guessed from the title, not stated in the post */}
                  {job.exp_source === "title" && "*"}
                </Tag>
              )}
            </div>
          </li>
        ))}
      </ul>

      {jobs.length === 0 && (
        <p className="py-16 text-center text-sm text-neutral-500">
          No jobs match those filters.
        </p>
      )}

      {nextCursor && (
        <div className="mt-8 text-center">
          <Link
            href={`/?${nextParams.toString()}`}
            className="inline-block rounded-md border border-neutral-300 px-4 py-2 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Load more
          </Link>
        </div>
      )}
    </main>
  );
}
