-- Push alerts: the same saved searches as email alerts, delivered as phone or
-- desktop notifications through the browser's push service (free, no daily
-- cap). A row is one search on one device.
--
-- No confirmation step: the browser only hands out a subscription after the
-- person allows notifications, and it can't be pointed at someone else.

CREATE TABLE push_subscriptions (
  id               bigserial PRIMARY KEY,
  -- The push service URL for this device; also what proves who's asking to
  -- change its alerts, since only that browser knows it.
  endpoint         text NOT NULL,
  p256dh           text NOT NULL,
  auth             text NOT NULL,
  filters          jsonb NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  -- Jobs first seen after this are new to the device.
  checked_until    timestamptz NOT NULL DEFAULT now(),
  last_sent_at     timestamptz,
  CONSTRAINT push_subscriptions_uniq UNIQUE (endpoint, filters)
);
