import { unstable_cache } from "next/cache";
import { cache } from "react";

import { query } from "./db";

export type Job = {
  id: string;
  title: string;
  apply_url: string;
  company_name: string;
  ats: string;
  department: string | null;
  location_raw: string | null;
  locations: string[];
  country: string | null;
  region: string | null;
  remote: boolean;
  remote_scope: string | null;
  open_to: string | null;
  exp_min_years: number | null;
  exp_max_years: number | null;
  exp_source: string | null;
  posted_at: string | null;
  closed_at: string | null;
  description_html?: string | null;
};

export type Filters = {
  q?: string;
  remote?: string;      // "1" | "anywhere" | "apac" | "hybrid" | "onsite"
  country?: string;
  region?: string;
  company?: string;
  department?: string;
  since?: string;       // days
  exp?: string;         // "0-1" | "1-2" | "3-5" | "5+" | "unknown"
  cursor?: string;      // "<posted_at ISO>|<id>"
  includeClosed?: boolean;
};

const PAGE_SIZE = 50;

/**
 * Only jobs from the past two weeks are listed: older roles have usually had
 * hundreds of applicants. Matches the workers' MAX_JOB_AGE_DAYS, which also
 * deletes them, so this just keeps pages right between syncs.
 */
export const MAX_AGE_DAYS = 14;
const FRESH = `COALESCE(j.posted_at, j.first_seen_at) > now() - interval '${MAX_AGE_DAYS} days'`;

/** Filter buckets -> [minYears, maxYears]; null max = open ended. */
export const EXP_BUCKETS: Record<string, [number, number | null]> = {
  "0-1": [0, 1],
  "1-2": [1, 2],
  "3-5": [3, 5],
  "5+": [5, null],
};

/** Build the shared WHERE clause. Params are appended to `params`. */
function buildWhere(f: Filters, params: unknown[]): string {
  const where: string[] = [FRESH];

  if (!f.includeClosed) where.push("j.closed_at IS NULL");

  if (f.q) {
    params.push(f.q);
    where.push(`j.search_tsv @@ websearch_to_tsquery('english', $${params.length})`);
  }
  if (f.remote === "1") where.push("j.remote");
  else if (f.remote === "anywhere") {
    // Truly unrestricted: no country or region named on the posting.
    where.push("j.remote AND j.open_to = 'anywhere'");
  } else if (f.remote === "apac") {
    // Applicable from Sri Lanka: unrestricted, or open to an APAC-wide region,
    // or explicitly naming a South Asian country.
    where.push(
      "j.remote AND (j.open_to = 'anywhere' " +
      "OR (j.open_to = 'region' AND j.region = 'APAC') " +
      "OR (j.open_to = 'country' AND j.country IN ('LK','IN')))",
    );
  } else if (f.remote === "hybrid") where.push("j.remote_scope = 'hybrid'");
  else if (f.remote === "onsite") where.push("NOT j.remote AND j.remote_scope IS DISTINCT FROM 'hybrid'");

  if (f.country) {
    params.push(f.country);
    where.push(`j.country = $${params.length}`);
  }
  if (f.region) {
    params.push(f.region);
    where.push(`j.region = $${params.length}`);
  }
  if (f.company) {
    params.push(f.company);
    where.push(`c.name = $${params.length}`);
  }
  if (f.department) {
    params.push(f.department);
    where.push(`j.department = $${params.length}`);
  }
  if (f.exp) {
    if (f.exp === "unknown") {
      where.push("j.exp_min_years IS NULL");
    } else {
      const [lo, hi] = EXP_BUCKETS[f.exp] ?? [];
      if (hi === null) {
        // Open-ended bucket ("5+"): the job must genuinely want that much.
        // Overlap alone would drag in a "1-8 years" role, which is not a 5+ job.
        params.push(lo);
        where.push(`j.exp_min_years >= $${params.length}`);
      } else if (lo !== undefined) {
        // Bounded bucket: match by overlap, so filtering "3-5" surfaces a job
        // asking for 2-6 years and an open-ended "5+" one you'd still qualify
        // for. exp_max_years IS NULL means open-ended.
        params.push(hi);
        const hiIdx = params.length;
        params.push(lo);
        where.push(
          `j.exp_min_years IS NOT NULL AND j.exp_min_years <= $${hiIdx} ` +
          `AND (j.exp_max_years IS NULL OR j.exp_max_years >= $${params.length})`,
        );
      }
    }
  }
  if (f.since) {
    params.push(Number(f.since));
    where.push(`j.posted_at > now() - make_interval(days => $${params.length})`);
  }
  return `WHERE ${where.join(" AND ")}`;
}

/**
 * Keyset pagination on (posted_at, id) — not OFFSET, which degrades badly once
 * the table is large. Served directly by jobs_open_posted_idx.
 */
/** Timestamps as ISO strings: what <time dateTime> wants, and what survives the cache. */
function iso(value: unknown): string | null {
  return value instanceof Date ? value.toISOString() : (value as string | null);
}

// The data changes once a day (the sync), so these are cached across requests
// and instances; a count up to 30 minutes old is fine. Bump the key suffix
// when a query's shape changes.
const FACETS_TTL = 1800;
const LIST_TTL = 600;

async function listJobsUncached(f: Filters): Promise<{ jobs: Job[]; nextCursor: string | null }> {
  const params: unknown[] = [];
  let sql = `
    SELECT j.id::text, j.title, j.apply_url, c.name AS company_name, j.ats::text,
           j.department, j.location_raw, j.locations, j.country, j.region,
           j.remote, j.remote_scope, j.open_to, j.posted_at, j.closed_at,
           j.exp_min_years, j.exp_max_years, j.exp_source
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      ${buildWhere(f, params)}`;

  if (f.cursor) {
    const [ts, id] = f.cursor.split("|");
    params.push(ts, id);
    const tsIdx = params.length - 1;
    sql += ` AND (j.posted_at, j.id) < ($${tsIdx}::timestamptz, $${params.length}::bigint)`;
  }

  params.push(PAGE_SIZE + 1);
  sql += ` ORDER BY j.posted_at DESC NULLS LAST, j.id DESC LIMIT $${params.length}`;

  const rows = (await query<Job>(sql, params)).map((j) => ({
    ...j,
    posted_at: iso(j.posted_at),
    closed_at: iso(j.closed_at),
  }));
  const hasMore = rows.length > PAGE_SIZE;
  const jobs = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
  const last = jobs.at(-1);
  const nextCursor =
    hasMore && last?.posted_at
      ? `${new Date(last.posted_at).toISOString()}|${last.id}`
      : null;

  return { jobs, nextCursor };
}

const listJobsCached = unstable_cache(listJobsUncached, ["jobs-v1"], { revalidate: LIST_TTL });

/** Text searches aren't cached: endless one-off combinations would crowd out the rest. */
export function listJobs(f: Filters) {
  return f.q ? listJobsUncached(f) : listJobsCached(f);
}

// cache(): the job page and its generateMetadata both ask for the same job.
export const getJob = cache(async function getJob(id: string): Promise<Job | null> {
  if (!/^\d{1,18}$/.test(id)) return null; // not a bigint: Postgres would throw
  const rows = await query<Job>(
    `SELECT j.id::text, j.title, j.apply_url, c.name AS company_name, j.ats::text,
            j.department, j.location_raw, j.locations, j.country, j.region,
            j.remote, j.remote_scope, j.open_to, j.posted_at, j.closed_at,
            j.exp_min_years, j.exp_max_years, j.exp_source,
            j.description_html
       FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.id = $1`,
    [id],
  );
  const job = rows[0];
  return job ? { ...job, posted_at: iso(job.posted_at), closed_at: iso(job.closed_at) } : null;
});

export const facets = unstable_cache(
  async () => {
    const [countries, departments, totals] = await Promise.all([
      query<{ country: string; n: string }>(
        `SELECT country, count(*) n FROM jobs j
          WHERE closed_at IS NULL AND ${FRESH} AND country IS NOT NULL
          GROUP BY country ORDER BY n DESC LIMIT 25`,
      ),
      query<{ department: string; n: string }>(
        `SELECT department, count(*) n FROM jobs j
          WHERE closed_at IS NULL AND ${FRESH} AND department IS NOT NULL
          GROUP BY department ORDER BY n DESC LIMIT 25`,
      ),
      query<{ open: string; remote: string; companies: string }>(
        `SELECT count(*) FILTER (WHERE closed_at IS NULL) open,
                count(*) FILTER (WHERE closed_at IS NULL AND remote) remote,
                (SELECT count(*) FROM companies WHERE enabled) companies
           FROM jobs j WHERE ${FRESH}`,
      ),
    ]);
    return { countries, departments, totals: totals[0] };
  },
  ["facets-v2"],
  { revalidate: FACETS_TTL },
);

/**
 * Every company with an open role, most jobs first. Thousands of names, so the
 * page doesn't embed them: the company filter fetches /api/companies on focus.
 */
export const companyOptions = unstable_cache(
  async () =>
    query<{ name: string; n: string }>(
      `SELECT c.name, count(*) n FROM jobs j JOIN companies c ON c.id=j.company_id
        WHERE j.closed_at IS NULL AND ${FRESH} GROUP BY c.name ORDER BY n DESC`,
    ),
  ["company-options-v1"],
  { revalidate: FACETS_TTL },
);

export async function listCompanies() {
  return query(
    `SELECT c.id::text, c.name, c.ats::text, c.board_token, c.enabled,
            c.last_synced_at, c.last_error, c.consecutive_failures, c.source,
            count(j.id) FILTER (WHERE j.closed_at IS NULL AND ${FRESH}) AS open_jobs
       FROM companies c LEFT JOIN jobs j ON j.company_id = c.id
      GROUP BY c.id ORDER BY open_jobs DESC, c.name`,
  );
}
