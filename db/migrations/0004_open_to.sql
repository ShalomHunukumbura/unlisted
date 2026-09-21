-- Where a remote job is actually open to.
--
-- `remote = true` does not mean you can apply: "Remote - Portugal" and
-- "Remote: United States" are remote AND geographically restricted. The
-- existing remote_scope conflated "no country matched" with "open worldwide",
-- so it could not answer this.
--
--   anywhere  no geographic restriction stated
--   region    restricted to a multi-country region (EU, APAC, LATAM…)
--   country   restricted to a single country
--   NULL      not remote, or undetermined
--
-- Classification is deliberately pessimistic: a remote job naming any place we
-- recognize counts as restricted. See workers/src/jobsite/remote_scope.py.

ALTER TABLE jobs ADD COLUMN open_to text;

CREATE INDEX jobs_open_to_idx ON jobs (open_to) WHERE closed_at IS NULL AND remote;
