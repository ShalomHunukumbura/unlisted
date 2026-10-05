-- When Unlisted started watching each board.
--
-- The job page shows "first seen by Unlisted" next to the employer's posted
-- date. That's only meaningful for jobs that appeared after we started
-- watching: on a board's first sync, every job is "first seen" at once. This
-- records that moment per board, so the page can tell the two cases apart.
--
-- It lives on companies rather than being derived from sync_runs because sync
-- logs are now pruned after a couple of days (hourly runs add ~125k rows a day).

ALTER TABLE companies ADD COLUMN first_synced_at timestamptz;

UPDATE companies c
   SET first_synced_at = r.first
  FROM (SELECT company_id, min(started_at) AS first
          FROM sync_runs
         WHERE status IN ('ok', 'suspicious')
         GROUP BY company_id) r
 WHERE r.company_id = c.id;

-- For each job, when Unlisted last checked its board *before* the job appeared.
-- Lets the page say "it wasn't on the board at our previous check, which was
-- after its posted date" (a repost or backdated listing) only with evidence:
-- a gap in syncing would otherwise look like a late listing. NULL for jobs
-- stored before this column existed, and for a board's first sync.
ALTER TABLE jobs ADD COLUMN board_checked_before timestamptz;
