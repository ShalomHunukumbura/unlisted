-- The application tracker: roles someone with an account has marked as applied
-- to, with where it stands and their own notes. The role is kept as it looked
-- when marked: jobs are deleted a week after they're posted, an application
-- goes on for longer than that.
CREATE TABLE applications (
  profile_id  bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id      bigint NOT NULL,
  title       text NOT NULL,
  company     text NOT NULL,
  location    text,
  apply_url   text NOT NULL,
  status      text NOT NULL DEFAULT 'applied'
              CHECK (status IN ('applied', 'interviewing', 'offer', 'rejected')),
  notes       text NOT NULL DEFAULT '',
  applied_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, job_id)
);
