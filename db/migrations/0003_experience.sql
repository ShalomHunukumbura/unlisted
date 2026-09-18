-- Experience level, inferred during ingestion.
--
-- No ATS exposes a structured experience field, so these are derived: first
-- from explicit year requirements in the description (~76% of jobs state one),
-- otherwise from seniority words in the title. exp_source records which, so the
-- UI can distinguish a stated requirement from an inferred one.
--
-- A [min, max] range rather than a single bucket, so filtering can match by
-- overlap: "3-5" should surface a job wanting 2-6 years and an open-ended "5+".
-- exp_max_years IS NULL means open-ended ("5+ years").

ALTER TABLE jobs
  ADD COLUMN exp_min_years smallint,
  ADD COLUMN exp_max_years smallint,
  ADD COLUMN exp_source    text;      -- 'description' | 'title' | NULL

ALTER TABLE jobs
  ADD CONSTRAINT jobs_exp_range_chk
  CHECK (exp_max_years IS NULL OR exp_min_years IS NULL OR exp_max_years >= exp_min_years);

-- Overlap queries filter on the minimum and then test the max, so an index on
-- the minimum over open jobs carries the common case.
CREATE INDEX jobs_exp_idx ON jobs (exp_min_years) WHERE closed_at IS NULL;
