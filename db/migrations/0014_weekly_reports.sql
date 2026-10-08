-- "Hiring this week": one row of numbers per ISO week (Monday, UTC). Jobs are
-- deleted a week after they're posted, so without these, last week's numbers
-- would be gone by the time this week's report compares with them.
--
-- The current week's row is rewritten after every sync; once the week is over
-- it's left alone. A few KB a week.
CREATE TABLE weekly_reports (
  week        date PRIMARY KEY,          -- the Monday it starts
  stats       jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
