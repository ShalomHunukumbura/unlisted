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
  // Base pay. numeric comes back from Postgres as a string. Only trusted when
  // comp_period is set: older rows may hold an equity or bonus figure.
  comp_min: string | null;
  comp_max: string | null;
  comp_currency: string | null;
  comp_period: "year" | "month" | "hour" | null;
  posted_at: string | null;
  closed_at: string | null;
  description_html?: string | null;
  first_seen_at?: string | null;     // when Unlisted first saw it
  first_synced_at?: string | null;   // when Unlisted started watching its board
  board_checked_before?: string | null; // last check of the board before the job appeared
  // List rows only: the same role (company + title) posted more than once,
  // e.g. once per city. The list shows the newest posting for the whole group.
  role_postings?: number;
  role_locations?: number;
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
  pay?: string;         // "listed" | "100" | "150" | "200" (thousand USD a year)
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

export const PAY_FLOORS = ["100", "150", "200"];

/** Build the shared WHERE clause. Params are appended to `params`. */
function buildWhere(f: Filters, params: unknown[]): string {
  const where: string[] = [FRESH];

  if (!f.includeClosed) where.push("j.closed_at IS NULL");

  if (f.q) {
    params.push(f.q);
    // Description words are stored without positions (migration 0008), so a
    // phrase can only match in the title, location or team. Quoted phrases
    // keep that strict meaning. Unquoted, websearch_to_tsquery still makes a
    // phrase out of hyphenated words ("full-stack" -> 'full-stack' <-> 'full'
    // <-> 'stack'), so those become plain AND: 'full-stack' is its own lexeme
    // and only appears where the text said full-stack.
    // Quoted searches go to the small title/location/team vector, which keeps
    // positions and has its own index.
    if (f.q.includes('"')) {
      where.push(`j.title_tsv @@ websearch_to_tsquery('english', $${params.length})`);
    } else {
      where.push(
        `j.search_tsv @@ regexp_replace(websearch_to_tsquery('english', $${params.length})::text, '<[0-9]*-?>', '&', 'g')::tsquery`,
      );
    }
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
  if (f.pay === "listed") where.push("j.comp_period IS NOT NULL");
  else if (f.pay && PAY_FLOORS.includes(f.pay)) {
    // The top of the range reaches the figure: a $120K-$160K role can pay
    // $150K. Dollars a year only; other currencies aren't converted.
    params.push(Number(f.pay) * 1000);
    where.push(`j.comp_currency = 'USD' AND j.comp_period = 'year' AND j.comp_max >= $${params.length}`);
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

// The data changes at most hourly (the sync), so these are cached across requests
// and instances; a count up to 30 minutes old is fine. Bump the key suffix
// when a query's shape changes.
const FACETS_TTL = 1800;
const LIST_TTL = 600;

async function listJobsUncached(f: Filters): Promise<{ jobs: Job[]; nextCursor: string | null }> {
  const params: unknown[] = [];
  const where = buildWhere(f, params);
  // The same conditions for another posting `s` of the same role. The filters
  // only name j and c, and c is the same company, so renaming j is enough and
  // the placeholders are shared.
  const sibling = `s.company_id = j.company_id AND lower(s.title) = lower(j.title) AND ${where
    .replace(/^WHERE /, "")
    .replace(/\bj\./g, "s.")}`;
  // One row per role: a posting is skipped when a newer posting of the same
  // role also matches, so the newest one stands for the group (and paging
  // never shows a role twice). Both lookups use jobs_role_idx.
  let sql = `
    SELECT j.id::text, j.title, j.apply_url, c.name AS company_name, j.ats::text,
           j.department, j.location_raw, j.locations, j.country, j.region,
           j.remote, j.remote_scope, j.open_to, j.posted_at, j.closed_at,
           j.exp_min_years, j.exp_max_years, j.exp_source,
           j.comp_min, j.comp_max, j.comp_currency, j.comp_period,
           r.postings AS role_postings, r.locations AS role_locations
      FROM jobs j
      JOIN companies c ON c.id = j.company_id
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS postings, count(DISTINCT s.location_raw)::int AS locations
          FROM jobs s WHERE ${sibling}
      ) r
      ${where}
       AND NOT EXISTS (
         SELECT 1 FROM jobs s WHERE ${sibling} AND (s.posted_at, s.id) > (j.posted_at, j.id)
       )`;

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

const listJobsCached = unstable_cache(listJobsUncached, ["jobs-v2"], { revalidate: LIST_TTL });

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
            j.comp_min, j.comp_max, j.comp_currency, j.comp_period,
            j.description_html, j.first_seen_at, c.first_synced_at, j.board_checked_before
       FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.id = $1`,
    [id],
  );
  const job = rows[0];
  return job
    ? {
        ...job,
        posted_at: iso(job.posted_at),
        closed_at: iso(job.closed_at),
        first_seen_at: iso(job.first_seen_at),
        first_synced_at: iso(job.first_synced_at),
        board_checked_before: iso(job.board_checked_before),
      }
    : null;
});

/** Other open postings of the same role (same company and title), e.g. other cities. */
export async function sameRole(id: string) {
  return (
    await query<{ id: string; location_raw: string | null; posted_at: string | null }>(
      `SELECT s.id::text, s.location_raw, s.posted_at
         FROM jobs j JOIN jobs s ON s.company_id = j.company_id AND lower(s.title) = lower(j.title)
        WHERE j.id = $1 AND s.id <> j.id AND s.closed_at IS NULL
          AND COALESCE(s.posted_at, s.first_seen_at) > now() - interval '${MAX_AGE_DAYS} days'
        ORDER BY s.location_raw NULLS LAST, s.posted_at DESC
        LIMIT 100`,
      [id],
    )
  ).map((s) => ({ ...s, posted_at: iso(s.posted_at) }));
}

/**
 * When the hourly sync last finished a board without errors. Shown on the home
 * page, so a stalled sync is visible to everyone, including me.
 */
async function lastSyncUncached(): Promise<string | null> {
  const rows = await query<{ at: Date | null }>(
    `SELECT max(finished_at) AS at FROM sync_runs WHERE status = 'ok'`,
  );
  return iso(rows[0]?.at ?? null);
}

export const lastSync = unstable_cache(lastSyncUncached, ["last-sync-v1"], { revalidate: 60 });

/** What the live "still open?" check needs to find the posting on its ATS. */
export async function getJobRef(id: string) {
  if (!/^\d{1,18}$/.test(id)) return null;
  const rows = await query<{
    ats: string;
    board_token: string;
    external_id: string;
    ats_config: Record<string, unknown> | null;
    closed_at: string | null;
  }>(
    `SELECT j.ats::text, c.board_token, j.external_id, c.ats_config, j.closed_at
       FROM jobs j JOIN companies c ON c.id = j.company_id
      WHERE j.id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

async function facetsUncached() {
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
}

export const facets = unstable_cache(facetsUncached, ["facets-v2"], { revalidate: FACETS_TTL });

/**
 * Every company with an open role, most jobs first. Thousands of names, so the
 * page doesn't embed them: the company filter fetches /api/companies on focus.
 */
async function companyOptionsUncached() {
  return query<{ name: string; n: string }>(
    `SELECT c.name, count(*) n FROM jobs j JOIN companies c ON c.id=j.company_id
      WHERE j.closed_at IS NULL AND ${FRESH} GROUP BY c.name ORDER BY n DESC`,
  );
}

export const companyOptions = unstable_cache(companyOptionsUncached, ["company-options-v1"], {
  revalidate: FACETS_TTL,
});

/**
 * Uncached and cheap (stops at the first row): is there anything to show?
 * False while the database is being refilled, which shows the "refreshing"
 * card. It also lets the page refuse a cached empty answer once jobs are back:
 * the caches above can hold "nothing" for up to 30 minutes after a refill.
 */
export async function hasOpenJobs(): Promise<boolean> {
  const rows = await query<{ any: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM jobs j WHERE j.closed_at IS NULL AND ${FRESH}) AS any`,
  );
  return rows[0]?.any ?? false;
}

/** The uncached versions, for when a cached empty answer is known to be stale. */
export const fresh = { facets: facetsUncached, listJobs: listJobsUncached, companyOptions: companyOptionsUncached };

export async function listCompanies() {
  return query(
    `SELECT c.id::text, c.name, c.ats::text, c.board_token, c.enabled,
            c.last_synced_at, c.last_error, c.consecutive_failures, c.source,
            count(j.id) FILTER (WHERE j.closed_at IS NULL AND ${FRESH}) AS open_jobs
       FROM companies c LEFT JOIN jobs j ON j.company_id = c.id
      GROUP BY c.id ORDER BY open_jobs DESC, c.name`,
  );
}
