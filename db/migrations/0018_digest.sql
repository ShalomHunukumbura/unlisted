-- The weekly email: an account's best "For you" matches, once a week, for
-- people who switch it on. digest_token is the secret in its unsubscribe
-- link (never the profile's own token, which is the key to the profile);
-- digest_at is when this profile was last looked at for one.
ALTER TABLE profiles
  ADD COLUMN digest        boolean NOT NULL DEFAULT false,
  ADD COLUMN digest_token  text UNIQUE,
  ADD COLUMN digest_at     timestamptz;

CREATE INDEX profiles_digest_idx ON profiles (digest_at NULLS FIRST) WHERE digest AND email IS NOT NULL;

-- They count toward the same daily email budget as alerts and sign-in links.
ALTER TABLE alert_sends DROP CONSTRAINT alert_sends_kind_check;
ALTER TABLE alert_sends ADD CONSTRAINT alert_sends_kind_check CHECK (kind IN ('confirm', 'alert', 'login', 'digest'));
