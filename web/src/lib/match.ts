import { skillFor } from "./catalog";
import { queryNoJit } from "./db";
import type { Profile } from "./profile";
import { EXP_BUCKETS, FRESH, buildWhere, iso, type Job } from "./queries";

/**
 * Ranking for "For you". Every open role (one posting per role) gets a score
 * from four signals, and the feed shows the best first:
 *
 *   role       0 or 3   the title names one of the roles they want
 *   skills     0 to 2   how many of their skills the posting mentions (5 = all of it)
 *   cv         0 to 4   how close the posting reads to their CV (embeddings)
 *   fresh      0 to 1   newer first, halving about every two days
 *
 * A role has to earn ROLE_MIN from the first three to be shown at all, so the
 * feed is "what fits", not "everything, sorted".
 *
 * The CV signal is cosine similarity between all-MiniLM-L6-v2 embeddings of
 * the CV (made in the browser) and of the posting (made by `jobsite embed`).
 * Measured on a week of jobs with a backend engineer's CV and a nurse's: the
 * median job scores 0.19 to 0.26, the closest 1% 0.39 to 0.48, the best 0.49
 * to 0.65. So 0.3 maps to 0 and 0.6 to the full 4, and the CV alone puts a
 * role in the feed from about 0.41 (the top few percent).
 */
const ROLE_POINTS = 3;
const SKILL_POINTS = 2;
const SKILLS_FOR_FULL = 5;
const CV_POINTS = 4;
const CV_FLOOR = 0.3;
const CV_FULL = 0.6;
const FRESH_POINTS = 1;
const FRESH_HALF_LIFE_HOURS = 48;
export const ROLE_MIN = 1.5;
/** For notifications: a role worth interrupting someone for. */
export const STRONG_MIN = 3;

const PAGE_SIZE = 30;

export type Match = Job & {
  role_hits: string[];
  skill_hits: string[];
  similarity: number | null;
  score: number;
};

/** How a skill is searched: its name and aliases as words, or as a substring of the title. */
function skillTerms(name: string) {
  const known = skillFor(name);
  return known
    ? { name, terms: known.literal ? [] : [known.name, ...(known.aliases ?? [])], literal: known.literal ?? null }
    : { name, terms: [name], literal: null };
}

/** A role as typed, plus the usual other spelling: "Engineer" and "Developer" are used for the same jobs. */
function roleTerms(role: string) {
  const swapped = /engineer/i.test(role)
    ? role.replace(/engineer/i, "Developer")
    : /developer/i.test(role)
      ? role.replace(/developer/i, "Engineer")
      : null;
  return { name: role, terms: swapped ? [role, swapped] : [role] };
}

// Titles that say "senior" in some way: a junior profile shouldn't be shown them.
// Not "manager": Product Manager is often a first role.
const SENIOR_TITLE = String.raw`\m(senior|sr|staff|principal|lead|head|director|vp|vice president|chief)\M`;
const LEADERSHIP_TITLE = String.raw`\m(principal|director|vp|vice president|head|chief)\M`;

/**
 * Experience as a preference, not the home page's strict filter: postings that
 * don't state it stay in, and so does one asking a year more than they have.
 */
function experienceClause(exp: string | undefined, params: unknown[]): string | null {
  if (!exp || !(exp in EXP_BUCKETS)) return null;
  const [, hi] = EXP_BUCKETS[exp];
  if (hi === null) return null;
  params.push(hi + 1);
  const years = `(j.exp_min_years IS NULL OR j.exp_min_years <= $${params.length})`;
  const title = hi <= 2 ? SENIOR_TITLE : LEADERSHIP_TITLE;
  return `${years} AND j.title !~* '${title}'`;
}

type Options = {
  pages?: number;
  /** Only roles first seen in (after, until], for notifications. */
  window?: { after: string; until: string };
  minScore?: number;
};

export async function matchJobs(profile: Profile, opts: Options = {}): Promise<{ jobs: Match[]; more: boolean }> {
  const params: unknown[] = [];
  const { exp, ...filters } = profile.prefs;
  let where = buildWhere(filters, params);
  const experience = experienceClause(exp, params);
  if (experience) where += ` AND ${experience}`;

  params.push(JSON.stringify(profile.skills.map(skillTerms)));
  const skillsParam = params.length;
  params.push(JSON.stringify(profile.roles.map(roleTerms)));
  const rolesParam = params.length;
  params.push(profile.embedding);
  const embeddingParam = params.length;
  params.push(profile.hidden);
  const hiddenParam = params.length;

  if (opts.window) {
    params.push(opts.window.after, opts.window.until);
    const [a, u] = [params.length - 1, params.length];
    // As in newMatches: a board added all at once isn't news.
    where += ` AND j.first_seen_at > $${a} AND j.first_seen_at <= $${u}
               AND COALESCE(j.posted_at, j.first_seen_at) > $${a}::timestamptz - interval '1 day'`;
  }

  const size = PAGE_SIZE * Math.max(1, Math.min(10, opts.pages ?? 1));
  params.push(opts.minScore ?? ROLE_MIN, size + 1);
  const [minParam, limitParam] = [params.length - 1, params.length];

  const terms = (alias: string) => `
    (SELECT string_agg('(' || q::text || ')', ' | ')::tsquery
       FROM unnest(${alias}.terms) t, plainto_tsquery('english', t) q
      WHERE q::text <> '')`;

  // Skills and roles are looked up one at a time through the GIN indexes,
  // and only then joined to the jobs. Testing every row's search_tsv instead
  // unpacks that large, out-of-line column per row and took over a second;
  // the planner doesn't count that cost and picks it anyway, unless each
  // lookup is its own subquery (LATERAL ... OFFSET 0, which isn't flattened).
  const sql = `
    -- MATERIALIZED: build each tsquery once, not once per row.
    WITH skills AS MATERIALIZED (
      SELECT s.name, s.literal, s.ord, ${terms("s")} AS q
        FROM ROWS FROM (jsonb_to_recordset($${skillsParam}::jsonb) AS (name text, terms text[], literal text))
             WITH ORDINALITY AS s(name, terms, literal, ord)
    ), roles AS MATERIALIZED (
      SELECT r.name, r.ord, ${terms("r")} AS q
        FROM ROWS FROM (jsonb_to_recordset($${rolesParam}::jsonb) AS (name text, terms text[]))
             WITH ORDINALITY AS r(name, terms, ord)
    ), skill_hits AS (
      SELECT id, array_agg(name ORDER BY ord) AS names FROM (
        SELECT j.id, s.name, s.ord FROM skills s CROSS JOIN LATERAL (
          SELECT j.id FROM jobs j WHERE j.search_tsv @@ s.q AND j.closed_at IS NULL AND ${FRESH} OFFSET 0
        ) j
        UNION
        -- C++ and friends: Postgres' parser drops the symbols, so the title instead.
        SELECT j.id, s.name, s.ord FROM skills s CROSS JOIN LATERAL (
          SELECT j.id FROM jobs j
           WHERE s.literal IS NOT NULL AND strpos(lower(j.title), s.literal) > 0 AND j.closed_at IS NULL AND ${FRESH}
          OFFSET 0
        ) j
      ) x GROUP BY id
    ), role_hits AS (
      -- title_tsv also holds the location and team: it finds candidates, the title decides.
      SELECT j.id, array_agg(r.name ORDER BY r.ord) AS names
        FROM roles r CROSS JOIN LATERAL (
          SELECT j.id FROM jobs j
           WHERE j.title_tsv @@ r.q AND to_tsvector('english', j.title) @@ r.q AND j.closed_at IS NULL AND ${FRESH}
          OFFSET 0
        ) j
       GROUP BY j.id
    ), matched AS (
      -- One posting per role (company + title): the newest that matches.
      SELECT DISTINCT ON (j.company_id, lower(j.title))
             j.id, j.company_id, j.title, j.apply_url, c.name AS company_name, j.ats::text,
             j.department, j.location_raw, j.locations, j.country, j.region,
             j.remote, j.remote_scope, j.open_to, j.posted_at, j.closed_at, j.first_seen_at,
             j.exp_min_years, j.exp_max_years, j.exp_source,
             j.comp_min, j.comp_max, j.comp_currency, j.comp_period,
             coalesce(rh.names, '{}') AS role_hits, coalesce(sh.names, '{}') AS skill_hits, v.similarity
        FROM jobs j
        JOIN companies c ON c.id = j.company_id
        LEFT JOIN role_hits rh ON rh.id = j.id
        LEFT JOIN skill_hits sh ON sh.id = j.id
        CROSS JOIN LATERAL (
          SELECT CASE WHEN $${embeddingParam}::halfvec IS NOT NULL AND j.embedding IS NOT NULL
                      THEN 1 - (j.embedding <=> $${embeddingParam}::halfvec) END AS similarity
        ) v
        ${where}
         AND (rh.id IS NOT NULL OR sh.id IS NOT NULL OR v.similarity > ${CV_FLOOR})
         -- "Not for me" hides the role, whichever of its postings was hidden.
         AND NOT EXISTS (
           SELECT 1 FROM jobs h
            WHERE h.id = ANY($${hiddenParam}::bigint[])
              AND h.company_id = j.company_id AND lower(h.title) = lower(j.title))
       ORDER BY j.company_id, lower(j.title), j.posted_at DESC NULLS LAST, j.id DESC
    ), scored AS (
      SELECT m.*,
             ${ROLE_POINTS} * (cardinality(m.role_hits) > 0)::int
             + ${SKILL_POINTS} * least(1, cardinality(m.skill_hits)::float
                 / greatest(1, least(${SKILLS_FOR_FULL}, (SELECT count(*) FROM skills))))
             + ${CV_POINTS} * coalesce(least(1, greatest(0, (m.similarity - ${CV_FLOOR}) / ${CV_FULL - CV_FLOOR})), 0)
             AS fit
        FROM matched m
    )
    SELECT id::text, title, apply_url, company_name, ats, department, location_raw, locations,
           country, region, remote, remote_scope, open_to, posted_at, closed_at,
           exp_min_years, exp_max_years, exp_source, comp_min, comp_max, comp_currency, comp_period,
           role_hits, skill_hits, round(similarity::numeric, 3)::float AS similarity,
           fit + ${FRESH_POINTS} * power(0.5, extract(epoch FROM now() - coalesce(posted_at, first_seen_at))
                                           / ${FRESH_HALF_LIFE_HOURS * 3600}) AS score
      FROM scored
     WHERE fit >= $${minParam}
     ORDER BY score DESC, id DESC
     LIMIT $${limitParam}`;

  const rows = await queryNoJit<Match>(sql, params);
  const jobs = rows.slice(0, size).map((j) => ({ ...j, posted_at: iso(j.posted_at), closed_at: iso(j.closed_at) }));
  return { jobs, more: rows.length > size };
}
