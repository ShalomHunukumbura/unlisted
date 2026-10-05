-- Fit Neon's free project limit, which is 512 MB (not the 1 GB 0006 assumed):
-- the database reached 489 MB and syncs failed with "project size limit
-- exceeded".
--
-- search_tsv was the largest thing stored (195 MB at 40k jobs), and most of it
-- is word positions, which only phrase matching uses. Positions are now kept
-- for title, location and department (5 MB) and dropped for description words
-- (strip). Measured: 195 MB -> 124 MB.
--
-- What changes for search: an exact phrase ("product manager") matches in the
-- title, location or team; single words still match anywhere, including in the
-- description. Hyphenated words ("full-stack") are one lexeme, so the web app
-- searches them as words, not phrases (see web/src/lib/queries.ts).
--
-- Re-adding the column rewrites the table, which needs free space about the
-- size of the table. On a full free-tier database, empty jobs first (TRUNCATE)
-- and let the next sync refill it.

CREATE OR REPLACE FUNCTION jobs_search_doc(title text, location_raw text, department text, description_html text)
RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE
RETURN
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(location_raw, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(department, '')), 'B') ||
  -- strip(): words without positions. left(..., 200000) is still load-bearing
  -- (tsvector caps at ~1 MB), see 0002.
  strip(to_tsvector('english'::regconfig, left(
    replace(replace(replace(replace(replace(replace(
      regexp_replace(coalesce(description_html, ''), '<[^>]+>', ' ', 'g'),
      '&nbsp;', ' '), '&quot;', '"'), '&#39;', ''''), '&lt;', '<'), '&gt;', '>'), '&amp;', '&'),
    200000)));

-- Recompute every stored vector with the new function.
ALTER TABLE jobs DROP COLUMN search_tsv;   -- drops jobs_search_idx with it

ALTER TABLE jobs ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS
  (jobs_search_doc(title, location_raw, department, description_html)) STORED;

CREATE INDEX jobs_search_idx ON jobs USING GIN (search_tsv);

-- Quoted phrases now only match in the title, location or team, so they get a
-- small vector and index of their own (~5 MB). Checking a phrase against the
-- big vector meant reading it for every candidate row: 2.3 s for
-- "product manager", against milliseconds here.
CREATE FUNCTION jobs_title_doc(title text, location_raw text, department text)
RETURNS tsvector
LANGUAGE sql IMMUTABLE PARALLEL SAFE
RETURN
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  setweight(to_tsvector('english'::regconfig, coalesce(location_raw, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(department, '')), 'B');

ALTER TABLE jobs ADD COLUMN title_tsv tsvector GENERATED ALWAYS AS
  (jobs_title_doc(title, location_raw, department)) STORED;

CREATE INDEX jobs_title_search_idx ON jobs USING GIN (title_tsv);

-- Trigram indexes from 0002 that nothing queries (no LIKE/similarity search on
-- job titles; `sync --company` matches a 7.7k-row table, which is instant
-- without one). 12 MB back.
DROP INDEX IF EXISTS jobs_title_trgm;
DROP INDEX IF EXISTS companies_name_trgm;
