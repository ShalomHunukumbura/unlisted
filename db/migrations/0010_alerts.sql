-- Email alerts: someone saves a set of filters with their address, confirms it
-- from an email, and after each hourly sync gets one email listing the roles
-- that matched since the last check.
--
-- Small by design (rows per subscriber, not per job): the 512 MB budget is the
-- jobs table's.

CREATE TABLE alert_subscriptions (
  id               bigserial PRIMARY KEY,
  email            text NOT NULL,
  -- The home page's filters, e.g. {"q": "python", "remote": "apac"}.
  filters          jsonb NOT NULL,
  -- Secret in the confirm and unsubscribe links; it's the only credential.
  token            text NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz,
  unsubscribed_at  timestamptz,
  -- Jobs first seen after this are new to the subscriber.
  checked_until    timestamptz,
  last_sent_at     timestamptz,
  CONSTRAINT alert_subscriptions_uniq UNIQUE (email, filters)
);

CREATE INDEX alert_subscriptions_active_idx ON alert_subscriptions (id)
  WHERE confirmed_at IS NOT NULL AND unsubscribed_at IS NULL;

-- Every email sent, kept two days: the daily cap (Gmail allows ~500 a day)
-- and the signup rate limits count from here.
CREATE TABLE alert_sends (
  sent_at          timestamptz NOT NULL DEFAULT now(),
  subscription_id  bigint REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN ('confirm', 'alert'))
);

CREATE INDEX alert_sends_sent_at_idx ON alert_sends (sent_at);

-- "First seen since the last check", once per subscription per hour. ~1 MB.
CREATE INDEX IF NOT EXISTS jobs_first_seen_idx ON jobs (first_seen_at) WHERE closed_at IS NULL;
