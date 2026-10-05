-- Make the schema small enough for a free-tier Postgres (Neon: 1 GB), so the
-- public deployment uses the same schema and sync code as local.
--
-- At 40,524 jobs (two weeks of every board) the two columns below were 343 MB
-- of an 857 MB database, and nothing reads them:
--
--   raw               216 MB  Full ATS payload, written every sync, never read.
--                             Now optional: kept locally, off in deployment
--                             (STORE_RAW=false).
--   description_text  127 MB  Duplicated description_html. Still computed in
--                             memory during sync (experience inference, change
--                             detection), just not stored.
--
-- search_tsv was built from description_text, so it's now built from the HTML:
-- tags stripped, then the entities nh3 leaves in decoded. On 8,000 jobs that
-- matched the old vector with 0 differences (with entities left in, 19 in 5,000
-- differed on URLs).
--
-- search_tsv itself (~200 MB) stays stored. A GIN index over the expression
-- alone would be 160 MB smaller, but phrase queries (quotes, and hyphenated
-- words like "full-stack") then recompute every candidate's vector: measured
-- 21.7 s for "product manager" against 34 ms with the stored column.

CREATE FUNCTION jobs_search_doc(title text, location_raw text, department text, description_html text)
RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE
RETURN
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  -- location_raw, not array_to_string(locations): see 0002.
  setweight(to_tsvector('english'::regconfig, coalesce(location_raw, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(department, '')), 'B') ||
  -- The left(..., 200000) is load-bearing, see 0002: tsvector caps at ~1 MB and
  -- a generated column that overflows fails the whole INSERT.
  setweight(to_tsvector('english'::regconfig, left(
    replace(replace(replace(replace(replace(replace(
      regexp_replace(coalesce(description_html, ''), '<[^>]+>', ' ', 'g'),
      '&nbsp;', ' '), '&quot;', '"'), '&#39;', ''''), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'),
    200000)), 'D');

ALTER TABLE jobs DROP COLUMN search_tsv;   -- drops jobs_search_idx with it

ALTER TABLE jobs ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS
  (jobs_search_doc(title, location_raw, department, description_html)) STORED;

CREATE INDEX jobs_search_idx ON jobs USING GIN (search_tsv);

ALTER TABLE jobs DROP COLUMN description_text;

ALTER TABLE jobs ALTER COLUMN raw DROP NOT NULL;
