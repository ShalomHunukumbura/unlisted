-- Empty the deployed jobs table so a schema change that rewrites it can run on
-- a full free-tier database, then let the next sync refill it (~25 minutes).
--
-- Board sync history is cleared too: the refill is then a "first sync" for
-- every board, so the job page says "already listed when Unlisted started
-- watching" instead of wrongly calling every re-added job a late repost.
--
-- Run before db/migrate.sh, e.g.:
--   psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -f db/deploy/reset-jobs.sql
--
-- Two transactions on purpose: TRUNCATE gives the space back only when it
-- commits, and at the size limit the UPDATE needs that space.
TRUNCATE jobs, sync_runs;
UPDATE companies
   SET first_synced_at = NULL,
       last_success_at = NULL,
       last_synced_at  = NULL;
