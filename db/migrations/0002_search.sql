-- Full-text search + the indexes that serve the hot query paths.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- The left(..., 200000) is load-bearing, not defensive padding.
-- tsvector caps at 1048575 bytes and this column is GENERATED ALWAYS, so a single
-- oversized job description would fail the entire INSERT. Verified on postgres:16:
--   ERROR: string is too long for tsvector (1450948 bytes, max 1048575 bytes)
ALTER TABLE jobs ADD COLUMN search_tsv tsvector GENERATED ALWAYS AS (
  setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') ||
  -- location_raw, not array_to_string(locations): array_to_string is only STABLE,
  -- not IMMUTABLE, so Postgres rejects it in a generated column. Filtering on
  -- locations[] goes through jobs_locations_gin instead.
  setweight(to_tsvector('english'::regconfig, coalesce(location_raw, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, coalesce(department, '')), 'B') ||
  setweight(to_tsvector('english'::regconfig, left(coalesce(description_text, ''), 200000)), 'D')
) STORED;

CREATE INDEX jobs_search_idx       ON jobs USING GIN (search_tsv);

-- Serves the default list view (open jobs, newest first) and keyset pagination.
CREATE INDEX jobs_open_posted_idx  ON jobs (posted_at DESC NULLS LAST, id DESC)
  WHERE closed_at IS NULL;

CREATE INDEX jobs_company_open_idx ON jobs (company_id) WHERE closed_at IS NULL;
CREATE INDEX jobs_remote_idx       ON jobs (remote)     WHERE closed_at IS NULL;
CREATE INDEX jobs_country_idx      ON jobs (country)    WHERE closed_at IS NULL;
CREATE INDEX jobs_locations_gin    ON jobs USING GIN (locations);

-- Closure detection sweeps on this.
CREATE INDEX jobs_last_seen_run_idx ON jobs (company_id, last_seen_run) WHERE closed_at IS NULL;

-- Admin autocomplete only; trigram over descriptions would be far too heavy.
CREATE INDEX jobs_title_trgm       ON jobs USING GIN (title gin_trgm_ops);
CREATE INDEX companies_name_trgm   ON companies USING GIN (name gin_trgm_ops);
