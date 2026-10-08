import { unstable_cache } from "next/cache";

import { query } from "./db";

/**
 * "Hiring this week": the numbers behind each weekly report, from the roles
 * posted in one ISO week (Monday 00:00 UTC to the next). One role is one
 * company + title, as the lists show them.
 *
 * Jobs are deleted a week after they're posted, so the numbers are saved as
 * the week goes (saveCurrentWeek, after every sync) and frozen once it ends.
 */

export type ReportStats = {
  week: string; // the Monday, YYYY-MM-DD
  roles: number;
  companies: number;
  remote: number;
  remoteAnywhere: number;
  openToSriLanka: number;
  payListed: number;
  /** Roles posted on each day, Monday first. */
  byDay: number[];
  topCompanies: { name: string; slug: string; roles: number }[];
  topCountries: { country: string; roles: number }[];
  /** Job titles (by phrase), most posted first. */
  titles: { title: string; roles: number }[];
  /** Skills mentioned anywhere in the posting. */
  skills: { skill: string; roles: number }[];
  /** Middle of the stated range, US dollars a year; only titles with 5+ postings stating pay. */
  pay: { title: string; median: number; low: number; high: number; n: number }[];
};

// Matched against the title, in Postgres tsquery syntax (<-> is "followed by").
const TITLES: [string, string][] = [
  ["Software Engineer", "software <-> engineer"],
  ["Data Engineer", "data <-> engineer"],
  ["Data Scientist", "data <-> scientist"],
  ["Data Analyst", "data <-> analyst"],
  ["Machine Learning Engineer", "machine <-> learning"],
  ["Product Manager", "product <-> manager"],
  ["Product Designer", "product <-> designer"],
  ["DevOps / SRE", "devops | sre | (site <-> reliability)"],
  ["Security Engineer", "security <-> engineer"],
  ["Account Executive", "account <-> executive"],
  ["Customer Success", "customer <-> success"],
  ["Engineering Manager", "engineering <-> manager"],
  ["Recruiter", "recruiter"],
  ["Registered Nurse", "registered <-> nurse"],
];

// Words matched anywhere in the posting.
const SKILLS = ["Python", "SQL", "AWS", "TypeScript", "React", "Java", "Kubernetes", "Go", "Rust", "Salesforce"];
const SKILL_QUERY: Record<string, string> = { Go: "golang" };

/** The Monday a date's week starts, YYYY-MM-DD (UTC). */
export function weekOf(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function weekEnd(week: string): Date {
  return new Date(new Date(`${week}T00:00:00Z`).getTime() + 7 * 86_400_000);
}

/** The week's roles, one posting per role. */
const WEEK = `
  SELECT DISTINCT ON (j.company_id, lower(j.title))
         j.id, j.company_id, j.title, j.remote, j.open_to, j.region, j.country,
         j.comp_min, j.comp_max, j.comp_currency, j.comp_period,
         COALESCE(j.posted_at, j.first_seen_at) AS at
    FROM jobs j
   WHERE COALESCE(j.posted_at, j.first_seen_at) >= $1::date
     AND COALESCE(j.posted_at, j.first_seen_at) < $1::date + 7
   ORDER BY j.company_id, lower(j.title), COALESCE(j.posted_at, j.first_seen_at) DESC`;

export async function computeWeek(week: string): Promise<ReportStats> {
  const [totals, byDay, companies, countries, titles, skills, pay] = await Promise.all([
    query<Omit<ReportStats, "week" | "byDay" | "topCompanies" | "topCountries" | "titles" | "skills" | "pay">>(
      `WITH w AS (${WEEK})
       SELECT count(*)::int AS roles,
              count(DISTINCT company_id)::int AS companies,
              count(*) FILTER (WHERE remote)::int AS remote,
              count(*) FILTER (WHERE remote AND open_to = 'anywhere')::int AS "remoteAnywhere",
              count(*) FILTER (WHERE remote AND (open_to = 'anywhere'
                OR (open_to = 'region' AND region = 'APAC')
                OR (open_to = 'country' AND country IN ('LK', 'IN'))))::int AS "openToSriLanka",
              count(*) FILTER (WHERE comp_period IS NOT NULL)::int AS "payListed"
         FROM w`,
      [week],
    ),
    query<{ d: number; n: number }>(
      `WITH w AS (${WEEK}) SELECT extract(isodow FROM at AT TIME ZONE 'UTC')::int AS d, count(*)::int AS n FROM w GROUP BY 1`,
      [week],
    ),
    query<{ name: string; slug: string; roles: number }>(
      `WITH w AS (${WEEK})
       SELECT min(c.name) AS name, c.slug, count(*)::int AS roles
         FROM w JOIN companies c ON c.id = w.company_id
        GROUP BY c.slug ORDER BY roles DESC, name LIMIT 10`,
      [week],
    ),
    query<{ country: string; roles: number }>(
      `WITH w AS (${WEEK})
       SELECT country, count(*)::int AS roles FROM w WHERE country IS NOT NULL
        GROUP BY country ORDER BY roles DESC LIMIT 8`,
      [week],
    ),
    query<{ title: string; roles: number }>(
      `WITH w AS MATERIALIZED (${WEEK})
       SELECT t.title, count(w.*)::int AS roles
         FROM unnest($2::text[], $3::text[]) AS t(title, q)
         LEFT JOIN w ON to_tsvector('english', w.title) @@ to_tsquery('english', t.q)
        GROUP BY t.title ORDER BY roles DESC`,
      [week, TITLES.map(([t]) => t), TITLES.map(([, q]) => q)],
    ),
    // Through the GIN index one skill at a time (see match.ts on why).
    query<{ skill: string; roles: number }>(
      `SELECT s.skill, (SELECT count(DISTINCT (j.company_id, lower(j.title)))::int FROM jobs j
                          WHERE j.search_tsv @@ plainto_tsquery('english', s.q)
                            AND COALESCE(j.posted_at, j.first_seen_at) >= $1::date
                            AND COALESCE(j.posted_at, j.first_seen_at) < $1::date + 7) AS roles
         FROM unnest($2::text[], $3::text[]) AS s(skill, q)
        ORDER BY roles DESC`,
      [week, SKILLS, SKILLS.map((s) => SKILL_QUERY[s] ?? s)],
    ),
    query<{ title: string; median: number; low: number; high: number; n: number }>(
      `WITH w AS MATERIALIZED (${WEEK}),
       paid AS (
         SELECT w.title, (w.comp_min + COALESCE(w.comp_max, w.comp_min)) / 2 AS mid FROM w
          WHERE w.comp_period = 'year' AND w.comp_currency = 'USD' AND w.comp_min > 10000
       )
       SELECT t.title,
              round(percentile_cont(0.5) WITHIN GROUP (ORDER BY p.mid))::int AS median,
              round(percentile_cont(0.25) WITHIN GROUP (ORDER BY p.mid))::int AS low,
              round(percentile_cont(0.75) WITHIN GROUP (ORDER BY p.mid))::int AS high,
              count(*)::int AS n
         FROM unnest($2::text[], $3::text[]) AS t(title, q)
         JOIN paid p ON to_tsvector('english', p.title) @@ to_tsquery('english', t.q)
        GROUP BY t.title HAVING count(*) >= 5 ORDER BY median DESC`,
      [week, TITLES.map(([t]) => t), TITLES.map(([, q]) => q)],
    ),
  ]);

  const days = Array(7).fill(0);
  for (const { d, n } of byDay) days[d - 1] = n;
  return {
    week,
    ...totals[0],
    byDay: days,
    topCompanies: companies,
    topCountries: countries,
    titles: titles.filter((t) => t.roles > 0),
    skills,
    pay,
  };
}

/**
 * After every sync: rewrite this week's numbers. Past weeks are never
 * rewritten; their jobs are gone, so a rewrite would only shrink them.
 */
export async function saveCurrentWeek(now = new Date()) {
  const week = weekOf(now);
  const stats = await computeWeek(week);
  await query(
    `INSERT INTO weekly_reports (week, stats) VALUES ($1, $2::jsonb)
     ON CONFLICT (week) DO UPDATE SET stats = EXCLUDED.stats, updated_at = now()`,
    [week, JSON.stringify(stats)],
  );
}

/** Finished weeks, newest first: the ones published as reports. */
export const finishedReports = unstable_cache(
  async () =>
    (
      await query<{ week: string; stats: ReportStats }>(
        `SELECT to_char(week, 'YYYY-MM-DD') AS week, stats FROM weekly_reports
          WHERE week + 7 <= (now() AT TIME ZONE 'UTC')::date ORDER BY week DESC`,
      )
    ).map((r) => r.stats),
  ["finished-reports-v1"],
  { revalidate: 3600 },
);
