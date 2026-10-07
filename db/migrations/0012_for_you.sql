-- "For you": a personal feed ranked against what someone wants (roles,
-- skills, preferences) and, if they upload a CV, how close each job reads to
-- it. The CV itself never reaches the server: the browser pulls the skills out
-- of it and turns it into an embedding, and only those are stored.

CREATE EXTENSION IF NOT EXISTS vector;

-- all-MiniLM-L6-v2 (384 dimensions) of the title and the start of the
-- description, written by `jobsite embed` after each sync. halfvec: half the
-- size of vector, same ranking. ~780 bytes a job, ~10 MB for a week of jobs.
-- No vector index: the feed filters first and then compares a few thousand
-- rows exactly, which takes milliseconds and costs no space.
ALTER TABLE jobs ADD COLUMN embedding halfvec(384);

-- What `jobsite embed` still has to do.
CREATE INDEX jobs_embed_todo_idx ON jobs (first_seen_at DESC) WHERE embedding IS NULL AND closed_at IS NULL;

-- One person's profile. No account: the browser keeps `token` in a cookie.
-- An email address is only added to open the same profile on another device.
CREATE TABLE profiles (
  id                  bigserial PRIMARY KEY,
  token               text NOT NULL UNIQUE,
  roles               text[] NOT NULL DEFAULT '{}',
  skills              text[] NOT NULL DEFAULT '{}',
  -- The home page's filters that make sense for a person:
  -- {"remote": "apac", "country": "LK", "exp": "3-5", "pay": "100"}.
  prefs               jsonb NOT NULL DEFAULT '{}',
  -- From the CV, in the browser. Null without one.
  embedding           halfvec(384),
  -- "Not for me": job ids, newest last, capped in the app.
  hidden              bigint[] NOT NULL DEFAULT '{}',
  -- Saved roles as they looked when saved: jobs are deleted a week after
  -- they're posted, the saved list shouldn't empty itself.
  saved               jsonb NOT NULL DEFAULT '[]',
  email               text UNIQUE,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  last_seen_at        timestamptz NOT NULL DEFAULT now()
);

-- Emailed sign-in links: single use, short lived. Opening one puts the
-- profile on that device and, the first time, gives the profile `email`.
CREATE TABLE profile_logins (
  token        text PRIMARY KEY,
  profile_id   bigint NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  used_at      timestamptz
);

-- Sign-in emails count toward the same daily Gmail budget as alerts.
ALTER TABLE alert_sends DROP CONSTRAINT alert_sends_kind_check;
ALTER TABLE alert_sends ADD CONSTRAINT alert_sends_kind_check CHECK (kind IN ('confirm', 'alert', 'login'));

-- "Notify me about new matches for you": a push subscription for a profile
-- instead of a search (filters stay '{}').
ALTER TABLE push_subscriptions ADD COLUMN profile_id bigint REFERENCES profiles(id) ON DELETE CASCADE;
